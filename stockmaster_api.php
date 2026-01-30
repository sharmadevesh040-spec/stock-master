<?php
/**
 * StockMaster Pro - Backend API for Hostinger
 * Updated to include all necessary sync endpoints.
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Configuration - Ensure these match your Hostinger DB details
$db_host = 'localhost';
$db_name = 'u123456789_stockmaster'; 
$db_user = 'u123456789_admin';       
$db_pass = 'YourPasswordHere';       

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name", $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    echo json_encode(['message' => 'Database connection failed', 'error' => $e->getMessage()]);
    exit();
}

function getJsonInput() {
    return json_decode(file_get_contents('php://input'), true);
}

function sendResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit();
}

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'register':
        $input = getJsonInput();
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        if (!$email || !$password) sendResponse(['message' => 'Missing email or password'], 400);
        $hashed = password_hash($password, PASSWORD_BCRYPT);
        try {
            $stmt = $pdo->prepare("INSERT INTO users (email, password) VALUES (?, ?)");
            $stmt->execute([$email, $hashed]);
            $userId = $pdo->lastInsertId();
            sendResponse(['id' => (string)$userId, 'email' => $email]);
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) sendResponse(['message' => 'Email already exists'], 400);
            sendResponse(['message' => 'Registration failed'], 500);
        }
        break;

    case 'login':
        $input = getJsonInput();
        $email = $input['email'] ?? '';
        $password = $input['password'] ?? '';
        $stmt = $pdo->prepare("SELECT id, email, password FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user && password_verify($password, $user['password'])) {
            sendResponse(['id' => (string)$user['id'], 'email' => $user['email']]);
        } else {
            sendResponse(['message' => 'Invalid email or password'], 401);
        }
        break;

    case 'getProducts':
        $userId = $_GET['userId'] ?? '';
        if (!$userId) sendResponse(['message' => 'Unauthorized'], 401);
        $stmt = $pdo->prepare("SELECT * FROM products WHERE userId = ? ORDER BY createdAt DESC");
        $stmt->execute([$userId]);
        $products = $stmt->fetchAll();
        foreach ($products as &$p) {
            $p['price'] = (float)$p['price'];
            $p['stock'] = (int)$p['stock'];
            $p['minStockLevel'] = (int)$p['minStockLevel'];
        }
        sendResponse($products);
        break;

    case 'addProduct':
        $input = getJsonInput();
        $userId = $input['userId'] ?? '';
        if (!$userId) sendResponse(['message' => 'Unauthorized'], 401);
        $id = uniqid('prod_');
        $stmt = $pdo->prepare("INSERT INTO products (id, userId, sku, name, category, price, stock, minStockLevel, supplierId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $id,
            $userId,
            $input['sku'],
            $input['name'],
            $input['category'],
            $input['price'],
            $input['stock'],
            $input['minStockLevel'] ?? 5,
            $input['supplierId'] ?? 's1'
        ]);
        $stmt = $pdo->prepare("SELECT * FROM products WHERE id = ?");
        $stmt->execute([$id]);
        sendResponse($stmt->fetch());
        break;

    case 'updateStock':
        $input = getJsonInput();
        $userId = $input['userId'] ?? '';
        $productId = $input['productId'] ?? '';
        $type = $input['type'] ?? '';
        $quantity = (int)($input['quantity'] ?? 0);
        if (!$userId || !$productId) sendResponse(['message' => 'Invalid request'], 400);
        $stmt = $pdo->prepare("SELECT stock, price FROM products WHERE id = ? AND userId = ?");
        $stmt->execute([$productId, $userId]);
        $product = $stmt->fetch();
        if (!$product) sendResponse(['message' => 'Product not found'], 404);
        $newStock = ($type === 'IN') ? $product['stock'] + $quantity : $product['stock'] - $quantity;
        $pdo->prepare("UPDATE products SET stock = ? WHERE id = ?")->execute([$newStock, $productId]);
        $transId = uniqid('tr_');
        $stmt = $pdo->prepare("INSERT INTO transactions (id, userId, productId, type, quantity, price) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$transId, $userId, $productId, $type, $quantity, $product['price']]);
        sendResponse(['status' => 'success', 'newStock' => $newStock]);
        break;

    case 'getTransactions':
        $userId = $_GET['userId'] ?? '';
        $stmt = $pdo->prepare("SELECT * FROM transactions WHERE userId = ? ORDER BY timestamp DESC");
        $stmt->execute([$userId]);
        $trans = $stmt->fetchAll();
        foreach ($trans as &$t) {
            $t['quantity'] = (int)$t['quantity'];
            $t['price'] = (float)$t['price'];
        }
        sendResponse($trans);
        break;

    case 'getSuppliers':
        // Safe placeholder for suppliers to ensure sync doesn't break
        sendResponse([]);
        break;

    default:
        sendResponse(['message' => 'Action not found'], 404);
        break;
}
?>