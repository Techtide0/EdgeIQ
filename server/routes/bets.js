const router = require('express').Router()
const authMiddleware = require('../middleware/authMiddleware')
const Bet = require('../models/Bet')

router.use(authMiddleware)

// POST /api/bets — create a bet
router.post('/', async (req, res) => {
  const { stake, odds, bonusExpected } = req.body

  if (!stake || !odds || stake <= 0 || odds <= 0) {
    return res.status(400).json({ error: 'stake and odds are required and must be positive' })
  }

  const bet = await Bet.create({
    userId:        req.user.uid,           // always from verified token
    stake,
    odds,
    potentialWin:  stake * odds,           // always calculated server-side
    bonusExpected: bonusExpected || 0,
  })

  res.status(201).json(bet)
})

// GET /api/bets — fetch all bets for the current user
router.get('/', async (req, res) => {
  const bets = await Bet.find({ userId: req.user.uid }).sort({ createdAt: -1 })
  res.json(bets)
})

// PUT /api/bets/:id — update a bet
router.put('/:id', async (req, res) => {
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
})

// DELETE /api/bets/:id — delete a bet
router.delete('/:id', async (req, res) => {
  const bet = await Bet.findOneAndDelete({ _id: req.params.id, userId: req.user.uid })
  if (!bet) return res.status(404).json({ error: 'Bet not found' })
  res.json({ message: 'Bet deleted' })
})

module.exports = router
