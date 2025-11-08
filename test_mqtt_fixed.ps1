# MQTT Broker Test - Fixed
$brokerHost = "89.24.76.191"
$ports = @(1883, 8883, 9001, 9002)

Write-Host "Testing MQTT broker at $brokerHost" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray

foreach ($port in $ports) {
    Write-Host "Testing port $port..." -ForegroundColor White
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($brokerHost, $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            Write-Host "Port ${port}: SUCCESS - Connection established" -ForegroundColor Green
        } else {
            Write-Host "Port ${port}: TIMEOUT - No response" -ForegroundColor Red
        }
        $tcpClient.Close()
    } catch {
        Write-Host "Port ${port}: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Yellow

# Additional ping test
Write-Host ""
Write-Host "Testing basic connectivity..." -ForegroundColor White
try {
    $ping = Test-Connection -ComputerName $brokerHost -Count 2 -Quiet
    if ($ping) {
        Write-Host "Ping: SUCCESS - Host is reachable" -ForegroundColor Green
    } else {
        Write-Host "Ping: FAILED - Host is not reachable" -ForegroundColor Red
    }
} catch {
    Write-Host "Ping: FAILED - $($_.Exception.Message)" -ForegroundColor Red
}
