const File = require('../models/File');

const uploadFile = async (req, res) => {
  const { filename, filesize, filehash, uploader } = req.body;
  try {
    const newFile = new File({ filename, filesize, filehash, uploader });
    await newFile.save();
    res.status(201).json(newFile);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  uploadFile,
};
