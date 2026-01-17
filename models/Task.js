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
  status: {
    type: String,
    enum: Object.values(IntervalStatus),
    default: IntervalStatus.PENDING
  },
  interval: {
    type: String,
    trim: true
  },
  taskEvidenceUrl: {
    type: String,
    trim: true
  }
}, { _id: false });

const taskSchema = new mongoose.Schema({
  taskName: {
    type: String,
    trim: true
  },
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
  startDateTime: {
    type: Number,
    default: null
  },
  endDateTime: {
    type: Number,
    default: null
  },
  taskIntervals: {
    type: [taskIntervalSchema],
    default: []
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'roles'
  },
  assignedTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  }],
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit'
  },
  status: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  },
  upDatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users'
  },
  weekDaysForMonthly: [{
    type: Number
  }],
  monthWeeks: [{
    type: Number
  }],
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