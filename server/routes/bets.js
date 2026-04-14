const router   = require('express').Router()
const mongoose = require('mongoose')
const authMiddleware = require('../middleware/authMiddleware')
const Bet      = require('../models/Bet')

router.use(authMiddleware)

// Rejects route early if :id is not a valid MongoDB ObjectId format.
// Prevents Mongoose CastError from propagating as a 500.
function validateObjectId(req, res, next) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: 'Invalid bet ID' })
  }
  next()
}

// POST /api/bets — create a bet
router.post('/', async (req, res) => {
  try {
    const { stake, odds, bonusExpected } = req.body

    if (!stake || !odds || stake <= 0 || odds <= 0) {
      return res.status(400).json({ error: 'stake and odds are required and must be positive' })
    }

    const bet = await Bet.create({
      userId:        req.user.uid,        // always from verified token
      stake,
      odds,
      potentialWin:  stake * odds,        // always calculated server-side
      bonusExpected: bonusExpected || 0,
    })

    res.status(201).json(bet)
  } catch (err) {
    console.error('[bets POST]', err.message)
    res.status(500).json({ error: 'Failed to create bet' })
  }
})

// GET /api/bets — fetch all bets for the current user
router.get('/', async (req, res) => {
  try {
    const bets = await Bet.find({ userId: req.user.uid }).sort({ createdAt: -1 })
    res.json(bets)
  } catch (err) {
    console.error('[bets GET]', err.message)
    res.status(500).json({ error: 'Failed to fetch bets' })
  }
})

// PUT /api/bets/:id — update a bet
router.put('/:id', validateObjectId, async (req, res) => {
  try {
    const bet = await Bet.findOne({ _id: req.params.id, userId: req.user.uid })
    if (!bet) return res.status(404).json({ error: 'Bet not found' })

    const { stake, odds, bonusExpected, bonusActual, status, cashoutAmount } = req.body

    // Cashout validation
    if (status === 'cashout') {
      if (cashoutAmount === undefined || cashoutAmount <= 0) {
        return res.status(400).json({ error: 'cashoutAmount must be greater than 0' })
      }
      if (cashoutAmount > bet.potentialWin) {
        return res.status(400).json({ error: 'cashoutAmount cannot exceed potentialWin' })
      }
      bet.cashoutAmount = cashoutAmount
    }

    if (stake         !== undefined) bet.stake         = stake
    if (odds          !== undefined) bet.odds          = odds
    if (bonusExpected !== undefined) bet.bonusExpected = bonusExpected
    if (bonusActual   !== undefined) bet.bonusActual   = bonusActual
    if (status        !== undefined) bet.status        = status

    // Recalculate if stake or odds changed
    if (stake !== undefined || odds !== undefined) {
      bet.potentialWin = bet.stake * bet.odds
    }

    if (status && status !== 'pending') {
      bet.resolvedAt = new Date()
    }

    await bet.save()
    res.json(bet)
  } catch (err) {
    console.error('[bets PUT]', err.message)
    res.status(500).json({ error: 'Failed to update bet' })
  }
})

// DELETE /api/bets/:id — delete a bet
router.delete('/:id', validateObjectId, async (req, res) => {
  try {
    const bet = await Bet.findOneAndDelete({ _id: req.params.id, userId: req.user.uid })
    if (!bet) return res.status(404).json({ error: 'Bet not found' })
    res.json({ message: 'Bet deleted' })
  } catch (err) {
    console.error('[bets DELETE]', err.message)
    res.status(500).json({ error: 'Failed to delete bet' })
  }
})

module.exports = router
