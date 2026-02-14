$baseUrl = "http://localhost:3001"
$email = "test-history@example.com"
$password = "HistoryTest123!"

$ProgressPreference = 'SilentlyContinue'

Write-Host "1. Testing Health..."
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get -ErrorAction Stop
    Write-Host "Health OK: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "Health Failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

Write-Host "`n2. Registering User..."
$body = @{ email = $email; password = $password }
try {
    $reg = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
    $token = $reg.token
    Write-Host "Registration Success. Token acquired." -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 409) {
        Write-Host "User exists (409), logging in..." -ForegroundColor Yellow
        try {
            $login = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($body | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
            $token = $login.token
            Write-Host "Login Success. Token acquired." -ForegroundColor Green
        } catch {
             Write-Host "Login Failed: $($_.Exception.Message)" -ForegroundColor Red
             exit
        }
    } else {
        Write-Host "Registration Failed: $($_.Exception.Message)" -ForegroundColor Red
        exit
    }
}

$headers = @{ Authorization = "Bearer $token" }

Write-Host "`n3. Testing Protected Route (Settings)..."
try {
    $settings = Invoke-RestMethod -Uri "$baseUrl/settings/ai-key" -Method Get -Headers $headers -ErrorAction Stop
    Write-Host "Settings Access OK (Key Found)" -ForegroundColor Green
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    if ($status -eq 404) {
        Write-Host "Settings Access OK (No Key Configured - Expected)" -ForegroundColor Yellow
    } else {
        Write-Host "Settings Access Failed: $($_.Exception.Message)" -ForegroundColor Red
        exit
    }
}

Write-Host "`n4. Testing Chat & History..."
$chatBody = @{ messages = @(@{ role = "user"; content = "Hello History" }) }
try {
    # Using Invoke-WebRequest to get headers
    $response = Invoke-WebRequest -Uri "$baseUrl/api/chat" -Method Post -Headers $headers -Body ($chatBody | ConvertTo-Json) -ContentType "application/json" -ErrorAction Stop
    
    # Check for X-Conversation-ID
    if ($response.Headers["X-Conversation-ID"]) {
        $convId = $response.Headers["X-Conversation-ID"]
        # If it's an array (sometimes happens), take first
        if ($convId -is [array]) { $convId = $convId[0] }
        Write-Host "Chat Success. X-Conversation-ID: $convId" -ForegroundColor Green
    } else {
        Write-Host "Chat Success but X-Conversation-ID header missing." -ForegroundColor Yellow
    }

    # Test GET /conversations
    Write-Host "  > Listing Conversations..."
    $convs = Invoke-RestMethod -Uri "$baseUrl/api/conversations" -Method Get -Headers $headers -ErrorAction Stop
    if ($convs.conversations.length -gt 0) {
        Write-Host "  > Found $($convs.conversations.length) conversations." -ForegroundColor Green
    } else {
        Write-Host "  > No conversations found (Unexpected)." -ForegroundColor Red
    }
    
    # Test GET /conversations/:id
    if ($convId) {
        Write-Host "  > Fetching Detail for $convId..."
        $detail = Invoke-RestMethod -Uri "$baseUrl/api/conversations/$convId" -Method Get -Headers $headers -ErrorAction Stop
        Write-Host "  > Detail Fetched. Messages count: $($detail.messages.length)" -ForegroundColor Green
        
        # Verify message content
        $msg = $detail.messages[0]
        if ($msg.content -match "Hello History") {
             Write-Host "  > Message Persistence Verified." -ForegroundColor Green
        } else {
             Write-Host "  > Message persistence check failed." -ForegroundColor Yellow
        }
    }

} catch {
    $ex = $_.Exception
    if ($ex.Response) {
        $status = $ex.Response.StatusCode.value__
        if ($status -eq 400) {
             # 400 is expected if no API key
             Write-Host "Chat: 400 Bad Request (Expected - No AI Key)" -ForegroundColor Yellow
             
             # Check if conversation created
             Write-Host "  > Checking if conversation was created despite 400..."
             try {
                $convs = Invoke-RestMethod -Uri "$baseUrl/api/conversations" -Method Get -Headers $headers -ErrorAction Stop
                Write-Host "  > Conversations found: $($convs.conversations.length)" -ForegroundColor Green
                
                # If we have conversation, persistence works for the creation part at least
             } catch {
                Write-Host "  > Failed to list conversations: $($_.Exception.Message)" -ForegroundColor Red
             }
        } else {
             Write-Host "Chat Failed: $status $($ex.Message)" -ForegroundColor Red
             $stream = $ex.Response.GetResponseStream()
             if ($stream) {
                $reader = New-Object System.IO.StreamReader($stream)
                Write-Host $reader.ReadToEnd()
             }
        }
    } else {
        Write-Host "Chat Error: $($ex.Message)" -ForegroundColor Red
    }
}
