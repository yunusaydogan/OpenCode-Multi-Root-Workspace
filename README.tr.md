# OpenCode Multi-Root Workspace — Türkçe

OpenCode Desktop **2.2.5 / V2** için MIT lisanslı MVP. Linux/Pardus üzerinde geliştirildi.
Frontend ve backend ayrı Git repoları olarak kalır; bir AI sohbetinde repo adlarıyla birlikte kullanılır.

## Kurulum

**Linux / Pardus:** ZIP'i açın ve proje klasöründe `sh install.sh` çalıştırın.
**Windows:** ZIP'i açın ve proje klasöründe `install.bat` çalıştırın (çift tıklayabilir veya terminalden başlatabilirsiniz).
Node.js 22.18+ LTS, npm ve Git kurulu olmalıdır; yönetici/sudo gerekmez.
Kurulum sırasında internet bağlantısı gerekir. OpenCode Desktop hedef sürümü 2.2.5'tir.

Kurucu bağımlılıkları yükler, kaynak dağıtımını test edip derler ve eklentinin bağımsız bir kopyasını
`~/.config/opencode/plugins/opencode-multi-root-workspace` altına yerleştirir. Windows'ta varsayılan
konum `%USERPROFILE%\.config\opencode\plugins\opencode-multi-root-workspace` olur.
`OPENCODE_CONFIG_DIR` ve `XDG_CONFIG_HOME` ayarları varsa önceliklidir.
Özel konum: `sh install.sh --config-dir "/özel/opencode"` veya `install.bat --config-dir "D:\OpenCode Config"`.
Özel konum kullanırsanız Desktop da aynı yapılandırma dizinini kullanmalıdır.

Mevcut ayarlar değiştirilmez; OpenCode global eklenti klasörünü otomatik keşfeder.
Güncellemeden önce Desktop'ı kapatın. Önceki kurulum, yapılandırma dizininde `.multi-root-backup-*`
klasörüne yedeklenir. Hata durumunda geçerli kurulum korunur. Kurulum bittikten sonra Desktop'ı
başlatın. Aynı eklentiyi ayrıca `plugins` listesine eklemeyin; daha önce elle eklediyseniz o kaydı kaldırın.
Kaldırmak için Desktop kapalıyken yalnız kurulan `plugins/opencode-multi-root-workspace` klasörünü silin.
Windows BAT dosyası hazırlandı; Windows ortamında çalıştırma doğrulaması yapılmadı.

### Elle kurulum (alternatif)

Aşağıdaki yöntem script kurulumuna alternatiftir; ikisini birlikte uygulamayın.

Kaynak klasöründe Node 22.18+ ve npm ile:

```sh
npm ci
npm run check
```

`~/.config/opencode/opencode.jsonc` dosyasındaki mevcut ayarlara ekleyin; yolu kendi
indirdiğiniz klasörün mutlak yolu ile değiştirin. V2'de anahtar **`plugins`**:

```json
{
  "plugins": ["/mutlak/yol/opencode-multi-root-workspace"],
  "permissions": [
    { "action": "workspace_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_git_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_write", "resource": "*", "effect": "ask" },
    { "action": "workspace_git_write", "resource": "*", "effect": "ask" }
  ]
}
```

Desktop'ı yeniden başlatın. Settings > Extensions > Plugins bölümünde eklentiyi kontrol edin.
Bir klasör açın ve ilk mesajınızı göndererek sohbet oluşturun. Komut paletinden
**Multi-Root Workspace: Open .workspace** çalıştırın ve manifest dosyanızı seçin.
**Status** her reponun durumunu, **Clear selection** mevcut sohbetin seçimini yönetir.
Dosya seçimi yalnız yerel Desktop sunucusundaki mevcut sohbetlerde desteklenir.

## Kod yazmadan yeni workspace

Bir yerel sohbet açtıktan sonra yan panelin **+** menüsünde **Yeni Workspace** seçin.
Aynı akış komut paletinde **Multi-Root Workspace: Yeni Workspace** olarak da bulunur.

1. Workspace adını yazın.
2. Klasör seçicisinden frontend/backend Git repolarınızı seçin. Farklı konumlar için **Başka klasör ekle** kullanın.
3. **Devam et** ile yalnız okuma, dosya düzenleme veya dosya düzenleme + Git erişimini seçin.
4. Workspace dosyasını kaydedeceğiniz klasörü seçin ve **Oluştur ve aç** düğmesine basın.

`.workspace` dosyası otomatik oluşturulur ve mevcut sohbette açılır; JSON düzenlemeniz gerekmez.
Repo adları klasör adlarından otomatik üretilir. Mevcut workspace dosyasının üzerine yazılmaz;
aynı konumda aynı ad varsa farklı bir workspace adı veya kayıt klasörü seçin.
Seçilen klasörler önceden var olan Git repo/worktree kökleri olmalıdır. Bu işlem yeni Git reposu oluşturmaz.
Yerleşik başlangıç proje seçicisi aynı kalır; **Yeni Workspace**, eklentinin yan panel menüsündedir.

## Manifest (elle düzenlemek isteyenler için)

`personel-portal.workspace` ile iki repo aynı üst klasörde bulunabilir:

```json
{
  "version": 1,
  "name": "Personel Portalı",
  "roots": [
    { "name": "frontend", "path": "./personel-frontend" },
    { "name": "backend", "path": "./personel-backend" }
  ],
  "allowFileWrites": false,
  "allowGitWrites": false
}
```

Yollar manifest konumuna göre çözülür. Her klasör gerçek bir Git repo/worktree kökü olmalıdır.
Yazmak için ilgili `allow...Writes` alanını `true` yapın. Bu alanlar OpenCode izinlerini kaldırmaz.
Dosya yazma ve Git değişiklikleri için eklenti ayrıca izin sorar; mevcut `read`/`edit` yasakları korunur.

AI'ya örnek:

> workspace_info ile iki repoyu göster. Her reponun AGENTS.md dosyasını oku.
> Frontend API çağrılarını backend endpointleriyle karşılaştır. İki reponun status/diff çıktısını ayrı göster.

> Backend'in staged diff'ini göster. Onayımdan sonra yalnız stage edilmiş değişiklikleri commit et;
> push için ayrıca sor.

`workspace_files`: listeleme, metin okuma/yazma. Yazarken önceki metin `expected` olarak gerekir;
yeni dosya için `expected: null`. Dosya başına 256 KiB, listelemede en fazla 1000 dosya.
`workspace_git`: status/diff/stage/commit/push. Commit seçilen reponun **stage edilmiş tüm dosyalarını**
içerir; otomatik `git add .` yoktur. Push yalnız mevcut branch'in ayarlı upstream'ine yapılır; force yoktur.
Repolar arasında ortak commit veya otomatik geri alma yoktur.

## Açık sınırlar

- Yerleşik proje seçicisi hâlâ klasör seçer. `.workspace` seçimi eklentinin ek komutundadır.
- Yerleşik explorer, arama, LSP, watcher ve Git ekranı çok köklü hâle gelmez.
- Eklentinin yazdığı dosyalar **yerleşik undo'ya dahil değildir**. Git ile kontrol edin.
- Yeni/fork/subagent sohbetler seçimi kendiliğinden devralmaz. Seçim sohbet bazında kalıcıdır.
- V1 desteği yoktur. V2 GUI API'si deneyseldir; hedef sürüm 2.2.5'tir.
- Desktop komutu derlendi ve sunucudan sunuldu; gerçek masaüstü pencere etkileşimlerinin tamamı
  otomasyonla test edilmedi. macOS/Windows ve uzak sunucular doğrulanmadı.
- Henüz npm yayını yoktur. Kaynaktan kurulumda derleme gerekir; `npm pack` hazır GUI içeren arşiv üretir.

Ayrıntılar: [İngilizce README](README.md), [API sınırları](docs/compatibility.md),
[test kanıtları](docs/validation.md), [yayın akışı](docs/publishing.md).
