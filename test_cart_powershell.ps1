# PowerShell Script to Test Cart Functionality
# Make sure your backend server is running on http://localhost:5000

Write-Host "🛒 Cart Testing Script" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green

# Step 1: Register a test user
Write-Host "`n🔐 Step 1: Registering test user..." -ForegroundColor Yellow
try {
    $registerBody = @{
        name = "Test User"
        email = "testuser@example.com"
        password = "TestPassword123!"
        phone = "+1234567890"
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST -ContentType "application/json" -Body $registerBody
    Write-Host "✅ User registered successfully" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Registration failed (user might already exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 2: Login to get token
Write-Host "`n🔐 Step 2: Logging in..." -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "testuser@example.com"
        password = "TestPassword123!"
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
    $token = $loginResponse.token
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 3: Test adding product to cart
Write-Host "`n🛒 Step 3: Testing cart addition..." -ForegroundColor Yellow

# Test 1: Add product with valid size
Write-Host "`n🧪 Test 1: Adding product with valid size 'M'" -ForegroundColor Cyan
try {
    $cartBody1 = @{
        productId = "6890cbadfd0efb1ef55aa184"
        quantity = 1
        size = "M"
    } | ConvertTo-Json

    $cartResponse1 = Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $token"} -Body $cartBody1
    Write-Host "✅ Successfully added product with size 'M'" -ForegroundColor Green
    Write-Host "Response: $($cartResponse1 | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to add product with size 'M': $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Add product without size (Free Size)
Write-Host "`n🧪 Test 2: Adding product without size (Free Size)" -ForegroundColor Cyan
try {
    $cartBody2 = @{
        productId = "6890cbadfd0efb1ef55aa184"
        quantity = 1
    } | ConvertTo-Json

    $cartResponse2 = Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $token"} -Body $cartBody2
    Write-Host "✅ Successfully added product without size" -ForegroundColor Green
    Write-Host "Response: $($cartResponse2 | ConvertTo-Json -Depth 3)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to add product without size: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Add product with invalid size
Write-Host "`n🧪 Test 3: Adding product with invalid size 'INVALID'" -ForegroundColor Cyan
try {
    $cartBody3 = @{
        productId = "6890cbadfd0efb1ef55aa184"
        quantity = 1
        size = "INVALID"
    } | ConvertTo-Json

    $cartResponse3 = Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $token"} -Body $cartBody3
    Write-Host "⚠️ Unexpected success with invalid size" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Correctly rejected invalid size: $($_.Exception.Message)" -ForegroundColor Green
}

# Test 4: Add product with invalid product ID
Write-Host "`n🧪 Test 4: Adding product with invalid product ID" -ForegroundColor Cyan
try {
    $cartBody4 = @{
        productId = "507f1f77bcf86cd799439999"
        quantity = 1
    } | ConvertTo-Json

    $cartResponse4 = Invoke-RestMethod -Uri "http://localhost:5000/api/cart/items" -Method POST -ContentType "application/json" -Headers @{"Authorization" = "Bearer $token"} -Body $cartBody4
    Write-Host "⚠️ Unexpected success with invalid product ID" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Correctly rejected invalid product ID: $($_.Exception.Message)" -ForegroundColor Green
}

# Step 4: Get cart contents
Write-Host "`n📋 Step 4: Getting cart contents..." -ForegroundColor Yellow
try {
    $cartContents = Invoke-RestMethod -Uri "http://localhost:5000/api/cart" -Method GET -Headers @{"Authorization" = "Bearer $token"}
    Write-Host "✅ Cart contents retrieved successfully" -ForegroundColor Green
    Write-Host "Cart: $($cartContents | ConvertTo-Json -Depth 4)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to get cart contents: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n✅ Cart testing completed!" -ForegroundColor Green 