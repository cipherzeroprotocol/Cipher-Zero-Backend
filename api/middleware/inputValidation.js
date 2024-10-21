const { check, validationResult } = require('express-validator'); // Import express-validator for validation

/**
 * Validation middleware for input validation.
 * Define validation rules for various routes.
 */
const validateUploadFile = [
  check('filename').notEmpty().withMessage('Filename is required'), // Ensure filename is provided
  check('filesize').isNumeric().withMessage('Filesize must be a number'), // Validate filesize is numeric
  check('filehash').notEmpty().withMessage('File hash is required'), // Ensure filehash is provided
  check('uploader').notEmpty().withMessage('Uploader is required'), // Ensure uploader is provided
  (req, res, next) => {
    const errors = validationResult(req); // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() }); // Return errors if validation fails
    }
    next(); // Proceed to the next middleware if validation succeeds
  }
];

// Export the validation middleware
module.exports = {
  validateUploadFile,
};
