const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  password: { type: String, required: true },
  email: { type: String, required: true },
});

const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  filesize: { type: Number, required: true },
  filehash: { type: String, required: true },
  uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
});

const TransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  file: { type: mongoose.Schema.Types.ObjectId, ref: 'File', required: true },
  timestamp: { type: Date, default: Date.now },
});

const SmartContractSchema = new mongoose.Schema({
  contractAddress: { type: String, required: true },
  abi: { type: Array, required: true },
  network: { type: String, required: true },
});

const User = mongoose.model('User', UserSchema);
const File = mongoose.model('File', FileSchema);
const Transaction = mongoose.model('Transaction', TransactionSchema);
const SmartContract = mongoose.model('SmartContract', SmartContractSchema);

module.exports = {
  User,
  File,
  Transaction,
  SmartContract,
};
