# MQTT Broker Connectivity Test
param(
    [string]$Host = "89.24.76.191",
    [int]$Timeout = 5
)

Write-Host "🚀 MQTT Broker Connectivity Test" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

Write-Host "🎯 Testing broker: $Host" -ForegroundColor Yellow
Write-Host ""

# Test TCP connections
$ports = @{
    "MQTT (TCP)" = 1883
    "MQTT over SSL" = 8883
    "MQTT over WebSocket" = 9001
    "MQTT over Secure WebSocket" = 9002
}

$results = @()

foreach ($port in $ports.GetEnumerator()) {
    $name = $port.Key
    $portNum = $port.Value
    
    Write-Host "🔌 Testing $name to $Host`:$portNum..." -ForegroundColor White
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($Host, $portNum, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne($Timeout * 1000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            $latency = "unknown"
            Write-Host "✅ TCP connection successful" -ForegroundColor Green
            $results += @{Name = $name; Success = $true; Message = "TCP connection successful"}
        } else {
            Write-Host "❌ TCP connection failed (timeout)" -ForegroundColor Red
            $results += @{Name = $name; Success = $false; Message = "TCP connection failed (timeout)"}
        }
        $tcpClient.Close()
    } catch {
        Write-Host "❌ TCP connection failed: $($_.Exception.Message)" -ForegroundColor Red
        $results += @{Name = $name; Success = $false; Message = "TCP connection failed: $($_.Exception.Message)"}
    }
}

Write-Host ""

# Test WebSocket connection
Write-Host "🌐 Testing WebSocket connection to ws://$Host`:9001/mqtt..." -ForegroundColor White
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect($Host, 9001, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne($Timeout * 1000, $false)
    
    if ($wait) {
        $tcpClient.EndConnect($connect)
        $stream = $tcpClient.GetStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $reader = New-Object System.IO.StreamReader($stream)
        
        $handshake = "GET /mqtt HTTP/1.1`r`nHost: $Host`:9001`r`nUpgrade: websocket`r`nConnection: Upgrade`r`nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==`r`nSec-WebSocket-Version: 13`r`n`r`n"
        $writer.Write($handshake)
        $writer.Flush()
        
        $response = $reader.ReadLine()
        $tcpClient.Close()
        
        if ($response -like "*101*") {
            Write-Host "✅ WebSocket handshake successful" -ForegroundColor Green
            $results += @{Name = "WebSocket"; Success = $true; Message = "WebSocket handshake successful"}
        } elseif ($response -like "*400*") {
            Write-Host "❌ WebSocket: Bad Request" -ForegroundColor Red
            $results += @{Name = "WebSocket"; Success = $false; Message = "WebSocket: Bad Request"}
        } elseif ($response -like "*404*") {
            Write-Host "❌ WebSocket: MQTT endpoint not found" -ForegroundColor Red
            $results += @{Name = "WebSocket"; Success = $false; Message = "WebSocket: MQTT endpoint not found"}
        } else {
            Write-Host "❌ WebSocket: Unexpected response" -ForegroundColor Red
            $results += @{Name = "WebSocket"; Success = $false; Message = "WebSocket: Unexpected response"}
        }
    } else {
        Write-Host "❌ WebSocket TCP connection failed (timeout)" -ForegroundColor Red
        $results += @{Name = "WebSocket"; Success = $false; Message = "WebSocket TCP connection failed (timeout)"}
    }
} catch {
    Write-Host "❌ WebSocket error: $($_.Exception.Message)" -ForegroundColor Red
    $results += @{Name = "WebSocket"; Success = $false; Message = "WebSocket error: $($_.Exception.Message)"}
}

Write-Host ""
Write-Host "=" * 50 -ForegroundColor Gray
Write-Host "📊 SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

$successful = 0
$total = $results.Count

foreach ($result in $results) {
    $status = if ($result.Success) { "✅" } else { "❌" }
    $color = if ($result.Success) { "Green" } else { "Red" }
    Write-Host "$status $($result.Name): $($result.Message)" -ForegroundColor $color
    if ($result.Success) { $successful++ }
}

Write-Host ""
Write-Host "🎯 Results: $successful/$total connections successful" -ForegroundColor Yellow

if ($successful -gt 0) {
    Write-Host "✅ MQTT broker is accessible!" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 RECOMMENDATIONS:" -ForegroundColor Cyan
    if ($results | Where-Object { $_.Name -like "*WebSocket*" -and $_.Success }) {
        Write-Host "🌐 Use WebSocket connection for browser compatibility"
    }
    if ($results | Where-Object { $_.Name -like "*Secure*" -and $_.Success }) {
        Write-Host "🔒 Use secure connection for production"
    }
    if ($results | Where-Object { $_.Name -like "*TCP*" -and $_.Success }) {
        Write-Host "🔌 Direct TCP connection available"
    }
} else {
    Write-Host "❌ MQTT broker is not accessible!" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 TROUBLESHOOTING:" -ForegroundColor Yellow
    Write-Host "1. Check if the broker IP is correct"
    Write-Host "2. Verify the broker is running"
    Write-Host "3. Check firewall settings"
    Write-Host "4. Verify port availability"
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
