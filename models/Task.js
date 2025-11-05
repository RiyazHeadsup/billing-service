const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const IntervalStatus = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  MISSED: 'missed'
};

const taskIntervalSchema = new mongoose.Schema({
  start: {
    type: Number
  },
  end: {
    type: Number
  },
  taskEvidenceUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: Object.values(IntervalStatus),
    default: IntervalStatus.PENDING
  }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  taskName: {
    type: String,
    trim: true
  },
  taskIntervals: {
    type: [taskIntervalSchema],
    default: []
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'roles'
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  }],
  description: {
    type: String,
    trim: true
  },
  priority: {
    type: String,
    trim: true
  },
  taskFrequency: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Number
  },
  updatedAt: {
    type: Number
  }
}, {
  timestamps: false
});

taskSchema.plugin(mongoosePaginate);

module.exports = {
  Task: mongoose.model('Task', taskSchema),
  IntervalStatus
};