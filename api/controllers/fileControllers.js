const File = require('../models/File'); // Import the File model
const logger = require('../utils/logger'); // Import logger for tracking errors
const { validateFileUpload } = require('../middleware/inputValidation'); // Helper for validating file input

/**
 * Handles file upload requests, saving file metadata to the database.
 * @param {Object} req - The request object, expects body to contain file metadata.
 * @param {Object} res - The response object for sending success or error responses.
 */
const uploadFile = async (req, res) => {
  const { filename, filesize, filehash, uploader } = req.body;

  // Validate file upload input (checks filename, file size, file hash, etc.)
  const { isValid, errors } = validateFileUpload({ filename, filesize, filehash, uploader });
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid file data', details: errors });
  }

  try {
    // Check if a file with the same hash already exists to prevent duplicates
    const existingFile = await File.findOne({ filehash });
    if (existingFile) {
      return res.status(409).json({ error: 'File with this hash already exists' });
    }

    // Create a new File document and save it to the database
    const newFile = new File({ filename, filesize, filehash, uploader });
    await newFile.save();

    // Respond with the saved file metadata
    res.status(201).json({ message: 'File uploaded successfully', file: newFile });
  } catch (err) {
    // Log the error for debugging and respond with a server error
    logger.error(`File upload error: ${err.message}`, { filename, filehash, uploader });
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  uploadFile,
};
