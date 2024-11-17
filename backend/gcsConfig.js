const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Configura la autenticación con tu archivo de claves de la cuenta de servicio
const storage = new Storage({
  keyFilename: path.join(__dirname, './proyecto-is-cc-bd6f9d082d59.json'),
  projectId: 'proyecto-is-cc',
});

const bucket = storage.bucket('pj_cc_is_bucket');
module.exports = bucket;