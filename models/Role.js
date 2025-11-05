const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

// CRUD Permission Schema
const crudPermissionSchema = new mongoose.Schema({
  read: {
    type: Boolean,
    required: true
  },
  write: {
    type: Boolean,
    required: true
  },
  delete: {
    type: Boolean,
    required: true
  }
}, { _id: false });

// Child Permission Schema
const childPermissionSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true
  },
  permission: {
    type: [crudPermissionSchema],
    required: true
  }
}, { _id: false });

// Main Permission Schema
const permissionSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true
  },
  permission: {
    type: [crudPermissionSchema],
    required: true
  },
  child: {
    type: [childPermissionSchema],
    default: []
  }
}, { _id: false });

// Role Schema
const roleSchema = new mongoose.Schema({
  roleName: {
    type: String,
    required: true
  },
  allowedEndPoints: {
    type: [String],
    required: true
  },
  permission: {
    type: [permissionSchema],
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  supportPermissions: {
    type: [permissionSchema],
    default: []
  },
  unitIds: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false
  },
  roleType: {
    type: String,
    required: false
  },
  noGst: {
    type: Boolean,
    required: false,
    default: false
  }
}, { timestamps: true });

roleSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Role', roleSchema);