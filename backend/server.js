const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcrypt');

const multer = require('multer');
const bucket = require('./gcsConfig');
const upload = multer({ storage: multer.memoryStorage() });

const generateSlId = () => {
   return 'SLS' + Math.random().toString(36).slice(2, 12);
};

const generateIngId = () => {
   return 'ING' + Math.random().toString(36).slice(2, 12);
};

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: 'http://proyecto-final-cloud-442104.uc.r.appspot.com/' }));

// Configurar la conexión a la base de datos PostgreSQL
const pool = new Pool({
   user: 'postgres',
   host: '34.55.84.123',
   database: 'pj-db',
   password: 'horcus420',
   port: 5432,
});

// Ruta de login
app.post('/api/login', async (req, res) => {
   const { email, password } = req.body;

   try {
      const queryText = 'SELECT * FROM users WHERE email = $1';
      const result = await pool.query(queryText, [email]);

      if (result.rows.length === 0) {
         return res.status(401).json({ message: 'Invalid email or password' });
      }

      const user = result.rows[0];
      // Comparar la contraseña proporcionada con el hash almacenado
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
         return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user.id, email: email, username: user.username, img_url: user.img_url, rol: user.rol }, 'your_secret_key', { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'strict' });
      res.json({ token: token, rol: user.rol });
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
   const userRol = 'client';
   const slId = generateSlId();

   //Verificar que los datos requeridos estén presentes
   if (!username || !email || !password) {
      return res.status(400).json({ message: 'Username, email, and password are required.' });
   }

   try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const queryText = 'INSERT INTO users (id, username, email, password_hash, img_url, rol) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id';
      const result = await pool.query(queryText, [id, username, email, hashedPassword, img_url, userRol]);
      const queryNewShoppingList = 'INSERT INTO shopping_lists (id, user_id) VALUES ($1, $2)';
      const resultSl = await pool.query(queryNewShoppingList, [slId, id]);
      const queryCurrentSl = 'INSERT INTO current_user_shop_list (user_id, shopping_list_id) VALUES ($1, $2)';
      const resultCurrent = await pool.query(queryCurrentSl, [id, slId]);


      // Devuelve el ID del nuevo usuario como respuesta
      res.status(201).json({ message: 'User created successfully', userId: result.rows[0].id });
   } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

//cambiar la shopping list
app.post('/api/completeShoppingList', async (req, res) => {
   const { id } = req.body;
   const slId = generateSlId();

   try {
      const queryNewShoppingList = 'INSERT INTO shopping_lists (id, user_id) VALUES ($1, $2)';
      const resultSl = await pool.query(queryNewShoppingList, [slId, id]);
      const queryCurrentSl = 'UPDATE current_user_shop_list SET shopping_list_id = $1 WHERE user_id = $2';
      const resultCurrent = await pool.query(queryCurrentSl, [slId, id]);


      // Devuelve el ID del nuevo usuario como respuesta
      res.status(201).json({ message: 'Shopping list changed successfully' });
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
   const status = "aproved"
   try {
      const queryText = 'SELECT * FROM recipes WHERE status=$1'; // Consulta para obtener todas las recetas
      const result = await pool.query(queryText, [status]);
      res.json(result.rows); // Devuelve todas las recetas como respuesta
   } catch (error) {
      console.error('Error fetching recipes:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

app.get('/api/pending', async (req, res) => {
   const status = "pending"
   try {
      const queryText = 'SELECT * FROM recipes where status = $1';
      const result = await pool.query(queryText, [status]);
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
   const { currentPassword, newPassword } = req.body;

   if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
   }

   try {
      // Obtener el usuario de la base de datos
      const queryText = 'SELECT password_hash FROM users WHERE id = $1';
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'User not found' });
      }

      const user = result.rows[0];

      // Comparar la contraseña actual proporcionada con el hash almacenado
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
         return res.status(401).json({ message: 'Current password is incorrect.' });
      }

      // Encriptar la nueva contraseña
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      // Actualizar la contraseña en la base de datos
      const updateQueryText = 'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id';
      const updateResult = await pool.query(updateQueryText, [hashedNewPassword, userId]);

      res.json({ message: 'Password updated successfully', userId: updateResult.rows[0].id });
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
   console.log(shoppingListId);
   console.log(id);
   console.log(quantity);

   try {
      const queryText = 'INSERT INTO shopping_list_ingredients (shopping_list_id, ingredient_id, quantity) VALUES ($1, $2, $3)';
      const result = await pool.query(queryText, [shoppingListId, id, quantity]);

      res.json({ message: 'Ingredients added successfully' });
   } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para eliminar un ingrediente de la lista de compras
app.delete('/api/shoppingList/ingredient/:id', async (req, res) => {
   const ingredientId = req.params.id;

   try {
      const queryText = 'DELETE FROM shopping_list_ingredients WHERE ingredient_id = $1 RETURNING shopping_list_id';
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
      const queryText = 'UPDATE shopping_list_ingredients SET quantity = $1 WHERE ingredient_id = $2 RETURNING shopping_list_id';
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
   const { id, name, description, instructions, user_id, img_url, ingredients, quantities, meal_time, meal_type } = req.body;
   const ingIds = [];
   console.log('los meals: ', meal_time, meal_type);

   try {
      //inicio de transacción
      await pool.query('BEGIN');

      //subir todos los ingredientes
      for (let i = 0; i < ingredients.length; i++) {
         const ingName = ingredients[i];
         const queryCheckIngredient = 'SELECT id FROM ingredients WHERE name = $1';
         const checkResult = await pool.query(queryCheckIngredient, [ingName]);

         let ingId;
         if (checkResult.rows.length > 0) {
            // Si el ingrediente existe, usar su ID
            ingId = checkResult.rows[0].id;
         } else {
            // Si no existe, crear un nuevo ingrediente
            ingId = generateIngId();
            const queryIngredient = 'INSERT INTO ingredients (id, name) VALUES ($1, $2)';
            await pool.query(queryIngredient, [ingId, ingName]);
         }
         ingIds.push(ingId);
      }

      //subir la receta
      const status = 'pending';
      const queryText = 'INSERT INTO recipes (id, name, description, instructions, user_id, img_url, status, meal_time, meal_type) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)';
      await pool.query(queryText, [id, name, description, instructions, user_id, img_url, status, meal_time, meal_type]);

      //hacer las relaciones de receta con ingredientes
      for (let i = 0; i < quantities.length; i++) {
         const queryIngredient = 'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES ($1, $2, $3)';
         await pool.query(queryIngredient, [id, ingIds[i], quantities[i]]);
      }

      //final de transacción
      await pool.query('COMMIT');
      res.status(201).json({ message: 'Receta creada con ingredientes' });
   } catch (error) {
      console.error('Error during newRecipe:', error);
      await pool.query('ROLLBACK'); // Asegurarse de revertir la transacción en caso de error
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para subir la imagen
app.post('/api/upload', upload.single('image'), async (req, res) => {
   if (!req.file) {
      return res.status(400).send('No se proporcionó ningún archivo');
   }

   // Crea un archivo en el bucket
   const fileName = `users_pp/${req.file.originalname}`;
   const blob = bucket.file(fileName);
   const blobStream = blob.createWriteStream({
      resumable: false,
   });

   blobStream.on('error', (err) => {
      console.error('Error al subir la imagen:', err);
      res.status(500).send({ message: 'Error al subir la imagen', error: err });
   });

   blobStream.on('finish', () => {
      // URL pública de la imagen subida
      const publicUrl = `https://storage.googleapis.com/pj_cc_is_bucket/${blob.name}`;
      res.status(200).send({ message: 'Imagen subida exitosamente', url: publicUrl });
   });

   blobStream.end(req.file.buffer);
});

// Ruta para subir la imagen de receta
app.post('/api/uploadRecipeImg', upload.single('image'), async (req, res) => {
   if (!req.file) {
      return res.status(400).send('No se proporcionó ningún archivo');
   }

   // Crea un archivo en el bucket
   const fileName = `recipe_images/${req.file.originalname}`;
   const blob = bucket.file(fileName);
   const blobStream = blob.createWriteStream({
      resumable: false,
   });

   blobStream.on('error', (err) => {
      console.error('Error al subir la imagen:', err);
      res.status(500).send({ message: 'Error al subir la imagen', error: err });
   });

   blobStream.on('finish', () => {
      // URL pública de la imagen subida
      const publicUrl = `https://storage.googleapis.com/pj_cc_is_bucket/${blob.name}`;
      res.status(200).send({ message: 'Imagen subida exitosamente', url: publicUrl });
   });

   blobStream.end(req.file.buffer);
});

//aprobar receta
app.put('/api/aprove/:id', async (req, res) => {
   const recipeId = req.params.id;
   const aprove = 'aproved'

   try {
      const queryText = 'UPDATE recipes SET status = $1 WHERE id = $2';
      const result = await pool.query(queryText, [aprove, recipeId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'recipe not found' });
      }

      res.json({ message: 'Status updated successfully' });
   } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

//desaprobar receta
app.delete('/api/denied/:id', async (req, res) => {
   const recipeId = req.params.id;

   try {
      const queryText = 'DELETE FROM recipes WHERE id = $1';
      const result = await pool.query(queryText, [recipeId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'recipe not found' });
      }

      res.json({ message: 'Recipe deleted successfully' });
   } catch (error) {
      console.error('Error updating ingredient:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para obtener todas las listas de compras de un usuario, excluyendo la lista actual
app.get('/api/shoppingLists/:userId', async (req, res) => {
   const userId = req.params.userId;

   try {
      // Obtener la lista actual del usuario
      const currentListQuery = 'SELECT shopping_list_id FROM current_user_shop_list WHERE user_id = $1';
      const currentListResult = await pool.query(currentListQuery, [userId]);

      if (currentListResult.rows.length === 0) {
         return res.status(404).json({ message: 'No current shopping list found for this user' });
      }

      const currentListId = currentListResult.rows[0].shopping_list_id;

      // Obtener todas las listas de compras del usuario, excluyendo la lista actual
      const queryText = 'SELECT * FROM shopping_lists WHERE user_id = $1 AND id != $2';
      const result = await pool.query(queryText, [userId, currentListId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'No shopping lists found for this user' });
      }

      res.json(result.rows);
   } catch (error) {
      console.error('Error fetching shopping lists:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para eliminar una lista de compras
app.delete('/api/shoppingList/:id', async (req, res) => {
   const shoppingListId = req.params.id;

   try {
      // Eliminar los ingredientes asociados a la lista de compras
      await pool.query('DELETE FROM shopping_list_ingredients WHERE shopping_list_id = $1', [shoppingListId]);

      // Eliminar la lista de compras
      const queryText = 'DELETE FROM shopping_lists WHERE id = $1';
      const result = await pool.query(queryText, [shoppingListId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'Shopping list not found' });
      }

      res.json({ message: 'Shopping list deleted successfully' });
   } catch (error) {
      console.error('Error deleting shopping list:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para obtener las recetas subidas por un usuario específico
app.get('/api/recipes/user/:userId', async (req, res) => {
   const userId = req.params.userId;

   try {
      const queryText = 'SELECT * FROM recipes WHERE user_id = $1';
      const result = await pool.query(queryText, [userId]);

      if (result.rows.length === 0) {
         return res.status(404).json({ message: 'No recipes found for this user' });
      }

      res.json(result.rows);
   } catch (error) {
      console.error('Error fetching user recipes:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Ruta para eliminar una receta específica
app.delete('/api/recipe/:id', async (req, res) => {
   const recipeId = req.params.id;

   try {
      const queryText = 'DELETE FROM recipes WHERE id = $1 RETURNING id';
      const result = await pool.query(queryText, [recipeId]);

      if (result.rowCount === 0) {
         return res.status(404).json({ message: 'Recipe not found' });
      }

      res.json({ message: 'Recipe deleted successfully', recipeId: result.rows[0].id });
   } catch (error) {
      console.error('Error deleting recipe:', error);
      res.status(500).json({ message: 'Internal server error' });
   }
});

// Configurar el puerto y escuchar
const port = 3001;
app.listen(port, '0.0.0.0', () => {
   console.log(`Servidor corriendo en el puerto ${port}`);
});
