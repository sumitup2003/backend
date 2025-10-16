//backend/controllers/callController.js

import CallHistory from '../models/CallHistory.js';
import User from '../models/User.js';

// @desc    Save call history
// @route   POST /api/calls/save
// @access  Private
export const saveCall = async (req, res) => {
  try {
    const { receiverId, callerId, type, status, duration } = req.body;

    const finalCallerId = callerId || req.user._id;
    const finalReceiverId = receiverId;

    if (!finalReceiverId) {
      return res.status(400).json({
        success: false,
        message: 'Receiver ID is required'
      });
    }


    const callHistory = await CallHistory.create({
      caller: finalCallerId,
      receiver: finalReceiverId,
      type: type || 'audio',
      status: status || 'missed',
      duration: duration || 0
    });

    await callHistory.populate([
      { path: 'caller', select: 'name username avatar verified' },
      { path: 'receiver', select: 'name username avatar verified' }
    ]);

    console.log('📞 Call saved:', callHistory);

    res.status(201).json({
      success: true,
      data: callHistory
    });
  } catch (error) {
    console.error('Save call error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get call history
// @route   GET /api/calls/history
// @access  Private
export const getCallHistory = async (req, res) => {
  try {
    const calls = await CallHistory.find({
      $or: [
        { caller: req.user._id },
        { receiver: req.user._id }
      ]
    })
    .populate('caller', 'name username avatar verified')
    .populate('receiver', 'name username avatar verified')
    .sort({ createdAt: -1 })
    .limit(100);

    res.status(200).json({
      success: true,
      data: calls
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get missed calls count
// @route   GET /api/calls/missed-count
// @access  Private
export const getMissedCallsCount = async (req, res) => {
  try {
    const count = await CallHistory.countDocuments({
      receiver: req.user._id,
      status: 'missed'
    });

    res.status(200).json({
      success: true,
      data: { count }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Mark missed calls as seen
// @route   PUT /api/calls/mark-seen
// @access  Private
export const markCallsAsSeen = async (req, res) => {
  try {
    await CallHistory.updateMany(
      { 
        receiver: req.user._id, 
        status: 'missed' 
      },
      { 
        $set: { status: 'seen' } 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Missed calls marked as seen'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete call history
// @route   DELETE /api/calls/:id
// @access  Private
export const deleteCall = async (req, res) => {
  try {
    const call = await CallHistory.findById(req.params.id);

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found'
      });
    }

    // Only allow deletion if user is caller or receiver
    if (
      call.caller.toString() !== req.user._id.toString() &&
      call.receiver.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await call.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Call deleted'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

