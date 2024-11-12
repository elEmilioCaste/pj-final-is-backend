const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Configura la autenticación con tu archivo de claves de la cuenta de servicio
const storage = new Storage({
  keyFilename: path.join(__dirname, './proyecto-final-is-cc-aaedc843171b.json'),
  projectId: 'proyecto-final-is-cc',
});

const bucket = storage.bucket('proyecto-final-is-cc.firebasestorage.app');
module.exports = bucket;