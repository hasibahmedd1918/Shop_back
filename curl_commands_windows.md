# Curl Commands for Adding Products to Cart (Windows PowerShell)

## Prerequisites
Make sure your backend server is running on `http://localhost:5000`

## Step 1: Register a User (if needed)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST -ContentType "application/json" -Body '{
  "name": "Test User",
  "email": "testuser@example.com", 
  "password": "TestPassword123!",
  "phone": "+1234567890"
}'
```

## Step 2: Login to Get Token
```powershell
$loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body '{
  "email": "testuser@example.com",
  "password": "TestPassword123!"
}'

$token = $loginResponse.token
Write-Host "Token: $token"
```

## Step 3: Add Product to Cart

### Option A: Add Product with Size
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "6890cbadfd0efb1ef55aa184",
  "quantity": 1,
  "size": "M"
}'
```

### Option B: Add Product without Size (Free Size)
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "6890cbadfd0efb1ef55aa184",
  "quantity": 1
}'
```

## Step 4: Get Cart Contents
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart" -Method GET -Headers @{
  "Authorization" = "Bearer $token"
}
```

## Available Products in Your Database

1. **Apple Iphone cleaning cloth** (ID: `6890cbadfd0efb1ef55aa184`)
   - Brand: Samsung
   - Price: $453
   - Available Sizes: M(2), L(3)

2. **Stripe Polo T-Shirt** (ID: `6890dff78cfd8b6b697c8b0f`)
   - Brand: Easy Polo
   - Price: $1150
   - Available Sizes: M(2), L(6)

3. **Stripe Polo T-Shirt** (ID: `689607c0eee0629a0016c95b`)
   - Brand: Easy Polo
   - Price: $1150
   - Available Sizes: M(2)

## Alternative: Using curl.exe (if available)
If you have curl.exe installed, you can use these commands:

```bash
# Login
curl.exe -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"testuser@example.com\",\"password\":\"TestPassword123!\"}"

# Add to cart with size
curl.exe -X POST http://localhost:5000/api/cart/items -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -d "{\"productId\":\"6890cbadfd0efb1ef55aa184\",\"quantity\":1,\"size\":\"M\"}"

# Add to cart without size
curl.exe -X POST http://localhost:5000/api/cart/items -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN_HERE" -d "{\"productId\":\"6890cbadfd0efb1ef55aa184\",\"quantity\":1}"

# Get cart
curl.exe -X GET http://localhost:5000/api/cart -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Testing Different Scenarios

### Test 1: Valid Product with Valid Size
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "6890cbadfd0efb1ef55aa184",
  "quantity": 2,
  "size": "L"
}'
```

### Test 2: Invalid Size
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "6890cbadfd0efb1ef55aa184",
  "quantity": 1,
  "size": "INVALID"
}'
```

### Test 3: Invalid Product ID
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "507f1f77bcf86cd799439999",
  "quantity": 1
}'
```

### Test 4: Insufficient Stock
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{
  "Authorization" = "Bearer $token"
} -Body '{
  "productId": "6890cbadfd0efb1ef55aa184",
  "quantity": 10,
  "size": "M"
}'
```

## Expected Responses

### Successful Addition
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "cart": {
    "items": [...],
    "totalItems": 1,
    "subtotal": 453,
    "total": 453
  }
}
```

### Error Responses
```json
{
  "success": false,
  "error": "Size M is not available for this product"
}
```

```json
{
  "success": false,
  "error": "Product not found"
}
```

```json
{
  "success": false,
  "error": "Only 2 items available in size M"
}
``` 