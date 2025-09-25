# Script PowerShell pour créer le premier admin
Write-Host "=== Création du premier administrateur ===" -ForegroundColor Green

# Demander les informations
$name = Read-Host "Nom de l'administrateur"
$email = Read-Host "Email de l'administrateur"
$password = Read-Host "Mot de passe (min 6 caractères)" -AsSecureString
$passwordText = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

# Vérifications
if ($name.Length -lt 2) {
    Write-Host "❌ Le nom doit contenir au moins 2 caractères" -ForegroundColor Red
    exit 1
}

if ($passwordText.Length -lt 6) {
    Write-Host "❌ Le mot de passe doit contenir au moins 6 caractères" -ForegroundColor Red
    exit 1
}

# Créer le JSON
$body = @{
    name = $name
    email = $email
    password = $passwordText
} | ConvertTo-Json

Write-Host "Création de l'administrateur..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/create-first-admin" -Method POST -ContentType "application/json" -Body $body
    Write-Host "✅ Administrateur créé avec succès !" -ForegroundColor Green
    Write-Host "Nom: $($response.user.name)" -ForegroundColor Cyan
    Write-Host "Email: $($response.user.email)" -ForegroundColor Cyan
    Write-Host "Rôle: $($response.user.role)" -ForegroundColor Cyan
} catch {
    $errorResponse = $_.Exception.Response
    if ($errorResponse) {
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $errorContent = $reader.ReadToEnd() | ConvertFrom-Json
        Write-Host "❌ Erreur: $($errorContent.error)" -ForegroundColor Red
    } else {
        Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Vérifiez que l'application fonctionne sur http://localhost:3000" -ForegroundColor Yellow
    }
}
