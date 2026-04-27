# POLAR lite

This project extends the original Flask template into POLAR lite, a local-first AI chat application. The codebase is now organized into three top-level folders:

- `app/`: application code
- `tests/`: domain-oriented test runners and test cases
- `deploy/`: reserved for future deployment workflows

In order to run the app, execute this:
```bash
source .venv/bin/activate
python app/web_server/main.py
```

To run all test domains:
```bash
source .venv/bin/activate
python tests/run_all.py
```

To run one domain only:
```bash
source .venv/bin/activate
python tests/data_m/run.py
```

sample API call:
> This endpoint does not require authentication or a request body.
```bash
curl -X POST http://localhost:5050/api/check \
     -H "Content-Type: application/json"
```

Documentation on how the structure and code works is right bellow

## Server

We have 3 different files:
- `main.py`: Starts the Flask Instance, is where the program starts to execute
- `server.py`: Manages the Flask application, adding every module created to it
- `app_routes.py`: Manages the routes in the web, here we define the logic used for the user to navigate between pages

On the other hand, the server complexity starts here: the implementation of different modules to structure the logic of the server in different processes through classes and methods to control all the data workflow. I have included 3 basic modules that i consider essential to every app:

### `data_m` — Database Management Layer

The database system uses SQLite with a three-layer architecture:

1. **DBConnector**  
   Handles raw `SQLite` connections.

2. **Database**  
   Low-level execution engine that:
   - runs SQL statements,
   - initializes the schema,
   - manages commits/rollbacks,
   - guarantees atomic operations.

3. **DBManager**  
   High-level interface exposing table-specific managers.

### Table Managers (t_*)
Each database table has its own dedicated class:
- `t_users`
- `t_sessions`
- `t_agent_logs`

Each of these classes encapsulates CRUD operations and ensures no raw SQL appears outside the data layer.

This design follows the Single Responsibility Principle (SRP) and supports clean scalability.

### `user_m` — User Management System

A module designed to register, login and logout users from the app by using `PyJWT` to generate tokens. The manager has the following methods that can be called using the instance of `user_manager`:
- **`user_manager` methods**: The manager has the following methods that can be called using the instance of the class
    - `check_user()`: can be called to check if the token received from the request is available, returns the user instance where all the information is stored
    - `login()`: checks if the user exists through `authenticate()` method and initializes a new instance for the user if it exists, if the user was already logged in, a new instance will be generated and will overwrite the old one
    - `logout()`: deletes the user instance from the caché
    - `get_user()`: receives an input token and returns the user instance correspondint to that token
    - `authenticate()`: calls the Database to check if the input user exists, returns `true` if the user exists and the password from the `login()` method is the same as the one in the Database. Returns `false` if either of both do not apply
    
- **`user` methods**: The user has 3 basic methods to manage all its information
    - `set_session_data()`: creates a value for a key in the `self.session_data` map.
    - `get_session_data()`: returns the value for the input key in the `self.session_data` map.
    - `clear_session()`: clears the session data leaving it empty

### `api_m` — Domain-Based API System

This module implements a dynamic API loader that scans `api_m/domains` and automatically registers every class that provides a `register()` method.

### `ApiManager`
- Automatically discovers and loads API domain classes.
- Registers their routes inside Flask.
- Integrates authentication seamlessly.
- Makes adding new APIs trivial.

### `api_m/domains/base_api.py`
Shared utilities for all API domains:
- unified response helpers (`ok()`, `error()`),
- centralized request authentication (`authenticate_request()`).

### Adding New API Domains
To add a new API, simply:
1. Create a class inside `api_m/domains/`.
2. Inherit from `BaseAPI`.
3. Implement a `register()` method that defines the endpoints.
4. Add the logic in instance methods.

The autoloader will pick it up automatically—no changes in `ApiManager`.

## Client

To make user managing easier, I created a JavaScript file called `token-handler.js` in `web_app/static/JS` with the following methods

### token handling
methods to handle the token locally
- `store_token(token)`: stores the input token in the local storage
- `getToken()`: returns the locally stored token
- `delete_token()`: deletes the locally stored token

### authentication
> IMPORTANT: ASYNC FUNCTION BELLOW
- `login(username, password) `: manages the login of the application connecting to the enpoint
- `send_API_request(method, endpoint, body = null)`: a generic method to call an API endpoint with the token managing logic implemented.

This makes it easier to manage the API calling from the client, it shall be used as the example bellow:

### LOGIN
```JavaScript
    try {
        const response = await login(username, password)

        const data = await response.json();
        console.log(data);

        if (response.ok && data.token) {
            store_token(data.token);
            loadPage("/");
        } else {
            errorMessage.textContent = data.error || "An error occurred.";
            errorMessage.style.display = "block";
        }
    } catch (error) {
        console.error("Error during login:", error);
        errorMessage.textContent = "Incorrect user, please try again.";
        errorMessage.style.display = "block";
    }
```

### API
```JavaScript

    // sending a message to a chatbot managed by Flask, expecting an answer
    try {
        const context = getChatContext()

        body = { 
            temperature: context.temperature,
            system_msg: context.system_msg,
            message: message 
        }

        const response = await send_API_request("POST", "/api/send-message", body)

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        return data[0];

    } catch (error) {
        console.error('Error:', error);
        return 'Something went wrong.';
    }
```
