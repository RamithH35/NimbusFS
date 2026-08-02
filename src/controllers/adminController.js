import FailureLog from '../storage/FailureLog.js';

/**
 * @desc    Get paginated failure logs newest first
 * @route   GET /api/admin/failures
 * @access  Private (Admin/Protected)
 */
export const getFailures = async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  // Build filters dynamically
  const filter = {};

  if (req.query.provider) {
    filter.provider = req.query.provider;
  }

  if (req.query.operation) {
    filter.operation = req.query.operation;
  }

  if (req.query.from || req.query.to) {
    filter.timestamp = {};
    if (req.query.from) {
      filter.timestamp.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      filter.timestamp.$lte = new Date(req.query.to);
    }
  }

  try {
    const failures = await FailureLog.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await FailureLog.countDocuments(filter);

    return res.status(200).json({
      failures,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get failures admin controller error:', error);
    return res.status(500).json({ error: 'Internal server error retrieving failure logs' });
  }
};

export default getFailures;
