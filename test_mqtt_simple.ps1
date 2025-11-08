# Simple MQTT Broker Test
$host = "89.24.76.191"
$ports = @(1883, 8883, 9001, 9002)

Write-Host "Testing MQTT broker at $host" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Gray

foreach ($port in $ports) {
    Write-Host "Testing port $port..." -ForegroundColor White
    
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connect = $tcpClient.BeginConnect($host, $port, $null, $null)
        $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
        
        if ($wait) {
            $tcpClient.EndConnect($connect)
            Write-Host "Port ${port}: SUCCESS" -ForegroundColor Green
        } else {
            Write-Host "Port ${port}: TIMEOUT" -ForegroundColor Red
        }
        $tcpClient.Close()
    } catch {
        Write-Host "Port ${port}: FAILED - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Yellow
