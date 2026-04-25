/**
 * Handle database errors and return user-friendly messages
 * @param {Error} error - The error object
 * @returns {string} User-friendly error message
 */
export const handleDatabaseError = (error) => {
  const errorMessage = error.message || error.toString();

  // Check for MongoDB connection errors
  if (errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('querySrv') ||
      errorMessage.includes('mongodb.net') ||
      errorMessage.includes('connection timed out') ||
      errorMessage.includes('failed to connect')) {
    return 'Unable to connect to our servers. Please check your internet connection and try again.';
  }

  // Check for authentication errors
  if (errorMessage.includes('authentication failed') ||
      errorMessage.includes('unauthorized')) {
    return 'Authentication failed. Please log in again.';
  }

  // Check for validation errors
  if (errorMessage.includes('validation failed')) {
    const errorBody = errorMessage.split(': ').slice(2).join(': ').split(', ');
    if (errorBody.length > 0 && errorBody[0].includes('required')) {
      const fieldNames = errorBody.map(e => e.split(': ')[0].replace('Path ', '').replace(/`/g, ''));
      const uniqueFields = [...new Set(fieldNames)];
      if (uniqueFields.length === 1) {
        return `${uniqueFields[0]} is required.`;
      }
      return `The following fields are required: ${uniqueFields.join(', ')}.`;
    }
    return 'Please fill in all mandatory fields.';
  }

  if (errorMessage.includes('required')) {
    return 'Please provide all required information.';
  }

  // Check for duplicate key errors
  if (errorMessage.includes('duplicate key') ||
      errorMessage.includes('already exists')) {
    return 'This item already exists.';
  }

  // Default to a generic message for other errors
  return 'Something went wrong. Please try again later.';
};