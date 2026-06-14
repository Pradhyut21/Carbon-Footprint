import app from './app.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.log(`CarbonLens Server listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
