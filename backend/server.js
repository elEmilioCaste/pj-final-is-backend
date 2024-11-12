const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const cors = require('cors');

const multer = require('multer');
const bucket = require('./gcsConfig');
const upload = multer({ storage: multer.memoryStorage() });


const corsOptions = {
   origin: '190.106.222.249',
   methods: ['GET', 'POST', 'PUT', 'DELETE'],
   credentials: true,
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));

// Configurar la conexión a la base de datos PostgreSQL
const pool = new Pool({
   user: 'postgres',
   host: '/cloudsql/proyecto-final-is-cc:us-central1-c:5013179873609293030',
   database: 'pj-db',
   password: 'horcus420',
   port: 5432,
});


// Ruta de login
app.post('/api/login', async (req, res) => {
   const { email, password } = req.body;

   try {
      const queryText = 'SELECT * FROM users WHERE email = $1 AND password_hash = $2';
      const result = await pool.query(queryText, [email, password]);

      if (result.rows.length === 0) {
         return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, email: email, username: user.username, img_url: user.img_url }, 'your_secret_key', { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'strict' });
      res.json({ token: token });
   } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta de logout
app.post('/api/logout', (req, res) => {
   res.clearCookie('token', { httpOnly: true, secure: false, sameSite: 'strict' });
   res.json({ message: 'Logout successful' });
});

const { v4: uuidv4 } = require('uuid'); // Importar la función para generar UUIDs

app.post('/api/newuser', async (req, res) => {
   const { id, username, email, password, img_url } = req.body;

   //Verificar que los datos requeridos estén presentes
   if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
   }

   try {
      // Generar un nuevo ID único
      // const userId = uuidv4(); // Generar un UUID para el nuevo usuario

      // Consulta para insertar el nuevo usuario en la base de datos con el ID generado
      const queryText = 'INSERT INTO users (id, username, email, password_hash, img_url) VALUES ($1, $2, $3, $4, $5) RETURNING id';
      const result = await pool.query(queryText, [id, username, email, password, img_url]); // Usar el userId generado

      // Devuelve el ID del nuevo usuario como respuesta
      res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
   } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para obtener los datos del usuario
app.get('/api/user/:id', async (req, res) => {
   const userId = req.params.id;

   try {
      const queryText = 'SELECT * FROM users WHERE id = $1';
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.json(result.rows[0]);
   } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para obtener la lista de compra actual
app.get('/api/currentSLS/:id', async (req, res) => {
   const userId = req.params.id;

   try {
      const queryText = 'SELECT * FROM current_user_shop_list WHERE user_id = $1';
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.json(result.rows[0]);
   } catch (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Para conseguir todas las recetas para la página principal
app.get('/api/mainRecipes', async (req, res) => {
   try {
      const queryText = 'SELECT * FROM recipes'; // Consulta para obtener todas las recetas
      const result = await pool.query(queryText);
      res.json(result.rows); // Devuelve todas las recetas como respuesta
   } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Para conseguir todas las recetas para su págia específica
app.get('/api/recipePage/:id', async (req, res) => {
   const recipeId = req.params.id;
   try {
      const queryText = 'SELECT * FROM recipes where id = $1';
      const result = await pool.query(queryText, [recipeId]);
      res.json(result.rows[0]);
   } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para actualizar el correo electrónico
app.put('/api/user/email/:id', async (req, res) => {
   const userId = req.params.id;
   const { email } = req.body;

   if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
   }

   try {
      const queryText = 'UPDATE users SET email = $1 WHERE id = $2 RETURNING id';
      const result = await pool.query(queryText, [email, userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Email updated successfully', userId: result.rows[0].id });
   } catch (error) {
      console.error('Error updating email:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para actualizar la contraseña
app.put('/api/user/password/:id', async (req, res) => {
   const userId = req.params.id;
   const { password } = req.body;

   if (!password) {
      return res.status(400).json({ message: 'Password is required.' });
   }

   try {
      const queryText = 'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id';
      const result = await pool.query(queryText, [password, userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Password updated successfully', userId: result.rows[0].id });
   } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para actualizar el nombre de usuario
app.put('/api/user/username/:id', async (req, res) => {
   const userId = req.params.id;
   const { username } = req.body;

   if (!username) {
      return res.status(400).json({ message: 'Username is required.' });
   }

   try {
      const queryText = 'UPDATE users SET username = $1 WHERE id = $2 RETURNING id';
      const result = await pool.query(queryText, [username, userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Username updated successfully', userId: result.rows[0].id });
   } catch (error) {
      console.error('Error updating username:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para obtener los ingredientes de una receta específica
app.get('/api/recipeIngredients/:id', async (req, res) => {
   const recipeId = req.params.id;
   try {
      const queryText = `
         SELECT i.name, ri.quantity, i.id
         FROM recipes r
         INNER JOIN recipe_ingredients ri ON r.id = ri.recipe_id
         INNER JOIN ingredients i ON ri.ingredient_id = i.id
         WHERE r.id = $1
      `;
      const result = await pool.query(queryText, [recipeId]);
      res.json(result.rows);
   } catch (error) {
      console.error('Error fetching recipe ingredients:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

app.get('/api/getShoppingList/:id', async (req, res) => {
   const sl_id = req.params.id;
   try {
      const queryText = `
         SELECT i.name, si.quantity, i.id
         FROM shopping_lists s
         INNER JOIN shopping_list_ingredients si ON s.id = si.shopping_list_id
         INNER JOIN ingredients i ON si.ingredient_id = i.id
         WHERE s.id = $1
      `;
      const result = await pool.query(queryText, [sl_id]);
      res.json(result.rows);
   } catch (error) {
      console.error('Error fetching recipe ingredients:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Para agregar ingredientes a la lista de compra
app.post('/api/addToShoppList', async (req, res) => {
   const { shoppingListId, id, quantity } = req.body;

   try {
      const queryText = 'INSERT INTO shopping_list_ingredients (shopping_list_id, ingredient_id, quantity) VALUES ($1, $2, $3)';
      const result = await pool.query(queryText, [shoppingListId, id, quantity]);

      if (result.rows.length === 0) {
         return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = result.rows[0];
      const token = jwt.sign({ id: user.id, email: email, username: user.username, img_url: user.img_url }, 'your_secret_key', { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'strict' });
      res.json({ token: token });
   } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para eliminar un ingrediente de la lista de compras
app.delete('/api/shoppingList/ingredient/:id', async (req, res) => {
   const ingredientId = req.params.id;

   try {
      const queryText = 'DELETE FROM shopping_list_ingredients WHERE ingredient_id = $1 RETURNING id';
      const result = await pool.query(queryText, [ingredientId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'Ingredient not found' });
      }

      res.json({ message: 'Ingredient deleted successfully', ingredientId: result.rows[0].id });
   } catch (error) {
      console.error('Error deleting ingredient:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para actualizar la cantidad de un ingrediente en la lista de compras
app.put('/api/shoppingList/ingredient/:id', async (req, res) => {
   const ingredientId = req.params.id;
   const { quantity } = req.body;

   if (!quantity) {
      return res.status(400).json({ message: 'Quantity is required.' });
   }

   try {
      const queryText = 'UPDATE shopping_list_ingredients SET quantity = $1 WHERE ingredient_id = $2 RETURNING id';
      const result = await pool.query(queryText, [quantity, ingredientId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'Ingredient not found' });
      }

      res.json({ message: 'Ingredient updated successfully', ingredientId: result.rows[0].id });
   } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Para subir una nueva receta
app.post('/api/newRecipe', async (req, res) => {
   const { id, name, description, instructions, user_id, img_url } = req.body;

   try {
      const queryText = 'INSERT INTO recipes (id, name, description, instructions, user_id, img_url, status) VALUES ($1, $2, $3, $4, $5, $6, "pending")';
      const result = await pool.query(queryText, [id, name, description, instructions, user_id, img_url]);

      if (result.rows.length === 0) {
         return res.status(401).json({ message: 'Invalid email or password' });
      }

      const recipe = result.rows[0];
      res.json({ message: 'se subió correctamente la receta bro', data: recipe });
   } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para subir la imagen
app.post('/api/upload', upload.single('image'), async (req, res) => {
   if (!req.file) {
      return res.status(400).send('No se proporcionó ningún archivo');
   }

   // Crea un archivo en el bucket
   const blob = bucket.file(req.file.originalname);
   const blobStream = blob.createWriteStream({
      resumable: false,
   });

   blobStream.on('error', (err) => {
      console.error('Error al subir la imagen:', err);
      res.status(500).send({ message: 'Error al subir la imagen', error: err });
   });

   blobStream.on('finish', () => {
      // URL pública de la imagen subida
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      res.status(200).send({ message: 'Imagen subida exitosamente', url: publicUrl });
   });

   blobStream.end(req.file.buffer);
});

// Configurar el puerto y escuchar
const port = 3001;
app.listen(port, () => {
   console.log(`Servidor corriendo en el puerto ${port}`);
});