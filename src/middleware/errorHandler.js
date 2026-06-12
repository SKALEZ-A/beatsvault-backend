// backend/src/middleware/errorHandler.js

function errorHandler(err, req, res, next) {
  console.error('❌ Error:', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Prisma not found
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Paystack / Axios errors
  if (err.response?.data) {
    return res.status(err.response.status || 502).json({
      error: err.response.data?.message || 'Payment provider error',
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
