# Ledger (매입/매출 통합 + PDF + Auth)

## 실행
```bash
# (프로젝트 루트에서)
docker compose down -v --remove-orphans
docker compose build --no-cache
docker compose up -d

docker compose ps
```

- Web: http://localhost:8088
- API health: http://localhost:8088/api/health

## PowerShell 테스트 (422 JSON 에러 해결 버전)
### 1) 로그인
```powershell
$login = curl.exe -s -X POST "http://localhost:8088/api/auth/login" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data "username=admin&password=admin1234" | ConvertFrom-Json
$token = $login.access_token
```

### 2) 거래처 생성 (JSON은 here-string 권장)
```powershell
$body = @'
{
  "name": "테스트거래처",
  "ceo": "홍길동",
  "phone": "010-0000-0000",
  "addr": "서울"
}
'@

curl.exe -i -X POST "http://localhost:8088/api/vendors" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-binary "$body"
```

### 3) 거래 생성
```powershell
$tx = @'
{
  "kind": "매출",
  "vendor_id": 1,
  "vat_rate": 0.1,
  "doc_no": "ST-2026-0001",
  "items": [
    {"name": "품목A", "qty": 2, "unit_price": 10000},
    {"name": "품목B", "qty": 1, "unit_price": 5500}
  ]
}
'@

curl.exe -i -X POST "http://localhost:8088/api/tx" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  --data-binary "$tx"
```

### 4) PDF 다운로드
```powershell
curl.exe -L -o tx1.pdf "http://localhost:8088/api/tx/1/pdf?doc_type=거래명세서" `
  -H "Authorization: Bearer $token"
```

## 직인(seal.png) 넣기
- `api` 컨테이너 내부에 `/app/assets/seal.png`가 실제로 있어야 함
- 방법 1) `api/Dockerfile`에 `COPY assets /app/assets` 추가
- 방법 2) compose에 볼륨 마운트 추가: `./assets:/app/assets`
