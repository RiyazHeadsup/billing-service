const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: false,
    unique: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  gender: {
    type: String,
    required: false
  },
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true
  },
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Account",
    required: false
  },
  unitIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Unit",
    required: false
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  img: {
    type: String,
    required: false
  },
  mpin: {
    type: String,
    required: false
  },
  userType: {
    type: String,
    required: false
  },
  createdBy: {
    type: String,
    required: false
  },
  updatedBy: {
    type: String,
    required: false
  },
  salary: {
    type: Number,
    required: false
  },
  weekOff: {
    type: String,
    required: false
  },
  pin: {
    type: Number,
    required: false
  },
  workingHours: {
    type: String,
    required: false
  },
  jwtToken: {
    type: String,
    required: false
  },
  deviceMacAddress: {
    type: String,
    required: false
  },
  target: {
    type: Number,
    required: false
  },
  status: {
    type: String,
    required: false,
    default:"active"
  },
  createdAt: {
    type: Number,
    required: false
  },
  updatedAt: {
    type: Number,
    required: false
  }
});

userSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('User', userSchema);