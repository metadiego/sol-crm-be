const mysql = require('promise-mysql');

/// SET UP SQL DB
const createUnixSocketPool = async config => {
  const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

  // Establish a connection to the database
  return mysql.createPool({
    user: process.env.DB_USER, // e.g. 'my-db-user'
    password: process.env.DB_PASS, // e.g. 'my-db-password'
    database: process.env.DB_NAME, // e.g. 'my-database'
    // If connecting via unix domain socket, specify the path
    socketPath: `${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}`,
    // Specify additional properties here.
    ...config,
  });
};


const createPool = async () => {
  const config = {
    // [START cloud_sql_mysql_mysql_limit]
    // 'connectionLimit' is the maximum number of connections the pool is allowed
    // to keep at once.
    connectionLimit: 5,
    // [END cloud_sql_mysql_mysql_limit]

    // [START cloud_sql_mysql_mysql_timeout]
    // 'connectTimeout' is the maximum number of milliseconds before a timeout
    // occurs during the initial connection to the database.
    connectTimeout: 10000, // 10 seconds
    // 'acquireTimeout' is the maximum number of milliseconds to wait when
    // checking out a connection from the pool before a timeout error occurs.
    acquireTimeout: 10000, // 10 seconds
    // 'waitForConnections' determines the pool's action when no connections are
    // free. If true, the request will queued and a connection will be presented
    // when ready. If false, the pool will call back with an error.
    waitForConnections: true, // Default: true
    // 'queueLimit' is the maximum number of requests for connections the pool
    // will queue at once before returning an error. If 0, there is no limit.
    queueLimit: 0, // Default: 0
    // [END cloud_sql_mysql_mysql_timeout]

    // [START cloud_sql_mysql_mysql_backoff]
    // The mysql module automatically uses exponential delays between failed
    // connection attempts.
    // [END cloud_sql_mysql_mysql_backoff]
  };

  return createUnixSocketPool(config);
};

const ensureSchema = async pool => {
  // Wait for tables to be created (if they don't already exist).
  await pool.query(
    `CREATE TABLE IF NOT EXISTS community_data 
      ( public_key VARCHAR(44) NOT NULL,
        mint_id VARCHAR(44) NOT NULL,
        ammount_owned BIGINT,
        purchase_events JSON,
        PRIMARY KEY (public_key, mint_id) 
      );
    `
  );
  console.log("Ensured that table 'community_data' exists");
};

const createPoolAndEnsureSchema = async () =>
  await createPool()
    .then(async pool => {
      await ensureSchema(pool);
      return pool;
    })
    .catch(err => {
      console.log(err);
      throw err;
    });

// Set up a variable to hold our connection pool. It would be safe to
// initialize this right away, but we defer its instantiation to ease
// testing different configurations.
let pool;

// Serve the index page, showing vote tallies.
// app.get('/', async (req, res) => {
//   pool = pool || (await createPoolAndEnsureSchema());
//   try {
//     // Get the 5 most recent votes.
//     const recentVotesQuery = pool.query(
//       'SELECT candidate, time_cast FROM votes ORDER BY time_cast DESC LIMIT 5'
//     );

//     // Run queries concurrently, and wait for them to complete
//     // This is faster than await-ing each query object as it is created
//     const recentVotes = await recentVotesQuery;


//     res.render('index.pug', {
//       recentVotes,
//       tabCount: tabsVotes.count,
//       spaceCount: spacesVotes.count,
//     });
//   } catch (err) {
//     logger.error(err);
//     res
//       .status(500)
//       .send(
//         'Unable to load page. Please check the application logs for more details.'
//       )
//       .end();
//   }
// });

async function testConnection() {
  pool = pool || (await createPoolAndEnsureSchema());
}

module.exports = { testConnection };