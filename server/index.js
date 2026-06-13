import app from './app.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`CarbonLens Server listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
