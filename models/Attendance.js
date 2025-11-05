const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const attendanceSchema = new mongoose.Schema({
  punchInTime: {
    type: String,
    trim: true
  },
  punchOutTime: {
    type: String,
    trim: true
  },
  totalHours: {
    type: String,
    trim: true
  },
  punchType: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    trim: true
  },
  remarks: {
    type: String,
    trim: true
  },
  deviceInfo: {
    type: Array,
    default: []
  },
  todaySalary: {
    type: Number
  },
  location: {
    type: String,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  }
}, { 
  timestamps: { 
    createdAt: 'created', 
    updatedAt: 'modified' 
  } 
});

attendanceSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Attendance', attendanceSchema);