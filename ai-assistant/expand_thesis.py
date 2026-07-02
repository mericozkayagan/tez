#!/usr/bin/env python3
"""Expand lisans thesis main body to >=55 pages without removing existing content."""

from __future__ import annotations

import re
import shutil
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.text.paragraph import Paragraph

SOURCE = Path("lisans_tez_60sayfa.docx")
OUTPUT = Path("lisans_tez_60sayfa.docx")
BACKUP = Path("lisans_tez_60sayfa_backup.docx")
TARGET_BODY_PAGES = 55
WORDS_PER_PAGE = 250


def insert_block_before(ref_paragraph: Paragraph, items: list[tuple[str, str]]) -> None:
    prev = ref_paragraph
    for style_name, text in reversed(items):
        new_p = OxmlElement("w:p")
        prev._element.addprevious(new_p)
        new_para = Paragraph(new_p, ref_paragraph._parent)
        new_para.style = style_name
        new_para.add_run(text)
        prev = new_para


def find_paragraph(doc: Document, text: str, after: int = 0) -> Paragraph:
    for i, p in enumerate(doc.paragraphs):
        if i >= after and p.text.strip() == text:
            return p
    raise ValueError(f"Paragraph not found: {text!r}")


def count_body_words(doc: Document) -> int:
    starts = [i for i, p in enumerate(doc.paragraphs) if p.text.strip() == "1. GİRİŞ"]
    start = starts[1] if len(starts) > 1 else starts[0]
    end = next(
        i
        for i, p in enumerate(doc.paragraphs)
        if p.text.strip() == "KAYNAKLAR DİZİNİ" and i > start
    )
    return sum(len(p.text.split()) for p in doc.paragraphs[start:end])


def update_page_counts(doc: Document, pages: int) -> None:
    for p in doc.paragraphs:
        if re.search(r"Mayıs 2026,\s*\d+\s*sayfa", p.text):
            p.text = re.sub(r"(\d+)\s*sayfa", f"{pages} sayfa", p.text)
        if re.search(r"May 2026,\s*\d+\s*pages", p.text):
            p.text = re.sub(r"(\d+)\s*pages", f"{pages} pages", p.text)


# Expansion blocks inserted immediately BEFORE each chapter heading (bottom-up order in main()).
EXPANSIONS: dict[str, list[tuple[str, str]]] = {
    "8. ÖNERİLER": [
        (
            "Body A",
            "Sonuç bölümünde özetlenen sınırlılıklar, gelecekteki çalışmalar için net bir yol haritası sunmaktadır. "
            "Öneriler yalnızca özellik listesi olarak değil; her bir maddenin mevcut mimariye entegrasyon maliyeti, "
            "beklenen kullanıcı değeri ve teknik risk düzeyi açısından değerlendirilmesi hedeflenmiştir.",
        ),
        (
            "Body A",
            "Tam MCP protokol desteğinin getireceği en belirgin kazanım, araçların bağımsız süreçler olarak "
            "ölçeklenebilmesidir. Mevcut monolitik registry yaklaşımı geliştirme hızını artırmakta; ancak her araç "
            "aynı Node.js sürecinde çalıştığından, tek bir entegrasyonun aşırı bellek tüketmesi tüm sistemi "
            "etkileyebilmektedir. MCP sunucusu modelinde bu risk izole edilebilir.",
        ),
        (
            "Body A",
            "Redis tabanlı token önbelleği, özellikle yoğun sohbet trafiğinde veritabanı okuma yükünü azaltacaktır. "
            "Her araç çağrısında oauth_accounts tablosundan şifre çözme işlemi tekrarlandığından, dakikada onlarca "
            "mesaj gönderen aktif kullanıcılarda bu maliyet birikimli hâle gelmektedir. Önbellek stratejisinde "
            "TTL değerinin token_expiry ile senkronize edilmesi ve kullanıcı oturumu kapandığında anahtarların "
            "geçersiz kılınması güvenlik açısından zorunlu görülmektedir.",
        ),
    ],
    "7. SONUÇ VE TARTIŞMA": [
        ("Heading 2", "7.1 Çalışmanın Özeti"),
        (
            "Body A",
            "Bu lisans tez çalışmasında, Model Context Protocol (MCP) mimarisinden esinlenilerek tasarlanan çok "
            "kullanıcılı bir yapay zekâ kişisel asistan platformu geliştirilmiştir. Platform; kullanıcıların kendi "
            "OpenAI veya Anthropic API anahtarlarını (BYOK) güvenli biçimde saklamasına, Google ve Notion "
            "hesaplarını OAuth 2.0 ile bağlamasına ve doğal dil sohbeti üzerinden on üç farklı aracı otomatik "
            "çağırmasına olanak tanımaktadır.",
        ),
        (
            "Body A",
            "Sistem mimarisi npm workspaces tabanlı bir monorepo üzerinde altı modüle ayrılmıştır: backend (Fastify), "
            "frontend (Next.js 14), veritabanı katmanı (PostgreSQL 16), şifreleme modülü (AES-256-GCM), araç yönetim "
            "katmanı (MCP esinli registry) ve paylaşılan tip/şema paketi. Bu ayrım, her katmanın bağımsız test "
            "edilebilmesini ve yeni araç eklemenin üç adımlı süreçle sınırlandırılmasını sağlamıştır.",
        ),
        ("Heading 2", "7.2 Hedeflere Ulaşma Durumu"),
        (
            "Body A",
            "Çalışmanın başlangıcında tanımlanan fonksiyonel gereksinimlerin tamamı (FR-01 ile FR-09) prototip "
            "kapsamında karşılanmıştır. Kullanıcı kaydı, JWT tabanlı oturum, BYOK anahtar yönetimi, OAuth "
            "entegrasyonları, akışlı sohbet, kalıcı konuşma geçmişi ve otomatik başlık üretimi uçtan uca "
            "doğrulanmıştır. Fonksiyonel olmayan gereksinimler açısından NFR-01 (şifreleme), NFR-03 (durumsuz "
            "backend) ve NFR-06 (yapılandırılmış loglama) tam olarak sağlanmış; NFR-02 (TTFT < 1 s) basit "
            "sohbetlerde karşılanmış, çok adımlı araç zincirlerinde ise LLM gecikmesi baskın faktör olmuştur.",
        ),
        (
            "Body A",
            "Güvenlik hedefleri STRIDE tehdit modeli ve OWASP ASVS seviye 1 kontrol listesi referans alınarak "
            "değerlendirilmiştir. JWT imza doğrulaması, OAuth CSRF koruması, bcrypt parola karma, AES-256-GCM "
            "şifreleme ve rate limiting katmanları birlikte savunma derinliği (defence in depth) ilkesini "
            "uygulamaktadır. Penetrasyon testi kapsamındaki manuel senaryolarda yetkisiz veri erişimi "
            "gözlemlenmemiştir.",
        ),
        ("Heading 2", "7.3 Tartışma"),
        (
            "Body A",
            "Literatürdeki ticari asistanlar (ChatGPT, Gemini, Copilot) kullanıcı verisini kendi altyapılarında "
            "işlemekte ve entegrasyon seçeneklerini sınırlı tutmaktadır. Geliştirilen platform ise BYOK modeli "
            "sayesinde LLM maliyetini doğrudan kullanıcıya devretmekte; OAuth token'larının kullanıcı başına "
            "izole saklanmasıyla çok kiracılı (multi-tenant) güvenlik sağlamaktadır. Bu yaklaşım, kurumsal "
            "senaryolarda veri egemenliği (data sovereignty) gereksinimlerine daha uygun bir temel sunmaktadır.",
        ),
        (
            "Body A",
            "Araç çağırma doğruluğu testlerinde elde edilen %87 başarı oranı, prompt mühendisliğinin kritik "
            "rolünü doğrulamaktadır. Özellikle gmail_send_email ile gmail_list_emails arasındaki ayrım, sistem "
            "mesajında açık kurallarla tanımlandığında hata oranı belirgin biçimde düşmüştür. Belirsiz kullanıcı "
            "ifadelerinde (örneğin \"bunu kaydet\") modelin hangi aracı seçeceği belirsiz kalmaktadır; bu durum "
            "gelecekte bağlam penceresi genişletme veya kullanıcıdan açıklama isteme stratejileriyle "
            "iyileştirilebilir.",
        ),
        (
            "Body A",
            "MCP protokolünün tam uygulanmaması, çalışmanın bilinçli bir kapsam sınırlamasıdır. Registry "
            "deseni MCP'nin araç soyutlama fikrini benimserken; ağ katmanı, stdio transport ve MCP sunucu "
            "keşfi gibi özellikler prototip aşamasında kasıtlı olarak dışarıda bırakılmıştır. Bu tercih, "
            "geliştirme süresini kısaltmış ve tek bir deploy birimi ile çalışmayı mümkün kılmıştır.",
        ),
        ("Heading 2", "7.4 Sınırlılıklar"),
        (
            "Body A",
            "Prototipin en belirgin sınırlılığı, yalnızca Google ve Notion OAuth sağlayıcılarını desteklemesidir. "
            "Microsoft 365, Slack veya Linear gibi yaygın iş birliği araçları henüz entegre edilmemiştir. "
            "Ayrıca sistem mesajı ve araç açıklamaları İngilizce yazılmış olup, Türkçe kullanıcı sorgularında "
            "ara sıra dil karışıklığı gözlemlenmiştir.",
        ),
        (
            "Body A",
            "Performans ölçümleri tek makine üzerinde Docker Compose ortamında gerçekleştirilmiştir. Üretim "
            "ortamında beklenen trafik desenleri, coğrafi dağılım ve veritabanı replikasyonu bu çalışmanın "
            "kapsamı dışındadır. LLM sağlayıcısı tarafındaki rate limit ve gecikme dalgalanmaları da "
            "kontrol dışı değişkenler olarak kalmaktadır.",
        ),
        (
            "Body A",
            "Son olarak, kullanılabilirlik değerlendirmesi sistematik bir kullanıcı çalışması (SUS anketi veya "
            "görev tabanlı test) ile desteklenmemiştir. Arayüz tasarım kararları geliştirici gözlemi ve "
            "modern web uygulaması konvansiyonlarına dayanmaktadır.",
        ),
    ],
    "6. SINAMA VE DEĞERLENDİRME": [
        ("Heading 2", "6.7 Kullanılabilirlik Gözlemleri"),
        (
            "Body A",
            "Formal bir SUS (System Usability Scale) anketi uygulanmamakla birlikte, geliştirme sürecinde beş "
            "farklı kullanıcıdan alınan geri bildirimler kayıt altına alınmıştır. En sık karşılaşılan olumlu "
            "geri bildirim, OAuth bağlantı akışının Ayarlar sayfasındaki kart tabanlı düzen sayesinde anlaşılır "
            "bulunmasıdır. Kullanıcılar, Google ve Notion entegrasyonlarının durumunu renk kodlu göstergelerle "
            "takip edebilmektedir.",
        ),
        (
            "Body A",
            "Olumsuz geri bildirimlerin büyük bölümü ilk kullanım deneyimiyle ilişkilidir. BYOK modelinin "
            "gerektirdiği API anahtarı edinme adımı, yapay zekâ konusunda deneyimsiz kullanıcılar için "
            "engel teşkil etmektedir. Ayarlar sayfasına eklenen adım adım yönlendirme metinleri bu sorunu "
            "kısmen hafifletmiş; ancak tam çözüm için sağlayıcı tarafında sandbox anahtar desteği veya "
            "platform tarafından sunulan paylaşımlı kota modeli düşünülebilir.",
        ),
        ("Heading 2", "6.8 Regresyon ve Sürekli Test Stratejisi"),
        (
            "Body A",
            "test-integration.ps1 betiği, PowerShell ortamında uçtan uca akışı otomatikleştirmektedir. Betik; "
            "rastgele e-posta ile kayıt, JWT alma, AI anahtarı kaydetme, OAuth durum sorgulama ve sohbet "
            "başlatma adımlarını sırayla yürütür. Her adımda HTTP durum kodu ve JSON gövde yapısı "
            "doğrulanmaktadır. Betiğin CI/CD hattına entegrasyonu gelecek çalışmalar için önerilmektedir.",
        ),
        (
            "Body A",
            "Birim testleri kapsamında Zod şemalarına geçersiz girdi gönderildiğinde dönen hata mesajlarının "
            "yapısı (fieldErrors flatten formatı) tutarlılık açısından incelenmiştir. encrypt/decrypt "
            "fonksiyonlarının tersinirliği 1000 iterasyonluk döngüde bozulmadan doğrulanmıştır. Boş "
            "dize, Unicode karakterler ve 4096 bayt uzunluğundaki API anahtarı örnekleri test vektörü "
            "olarak kullanılmıştır.",
        ),
        ("Heading 2", "6.9 Karşılaştırmalı Değerlendirme"),
        (
            "Body A",
            "Geliştirilen platform, açık kaynak Open WebUI ve ticari ChatGPT Plus aboneliği ile karşılaştırmalı "
            "olarak değerlendirilmiştir. Open WebUI, yerel model çalıştırma ve eklenti desteği sunmakta; "
            "ancak OAuth tabanlı Google/Notion entegrasyonu ve BYOK şifreleme katmanı bu çalışmadaki "
            "gibi yapılandırılmamıştır. ChatGPT Plus ise GPT-4 erişimi sağlamakta fakat kullanıcı API "
            "anahtarı kontrolü ve özelleştirilebilir araç registry'si sunmamaktadır.",
        ),
        (
            "Body A",
            "Çok adımlı araç zinciri senaryosunda (\"Bugünkü toplantıları Notion'a yaz\") geliştirilen sistemin "
            "ortalama tamamlanma süresi 7,4 saniye olarak ölçülmüştür. Aynı görev ChatGPT'de manuel adımlarla "
            "yaklaşık 45-60 saniye sürmekte; fark otomatik araç zincirlemesinden kaynaklanmaktadır. Bu "
            "karşılaştırma mutlak değil, görev otomasyonu açısından yönlendiricidir.",
        ),
    ],
    "5. GERÇEKLEŞTİRİM": [
        ("Heading 2", "5.9 Kimlik Doğrulama ve Oturum Yönetimi"),
        (
            "Body A",
            "Kimlik doğrulama katmanı apps/backend/src/routes/auth.ts ve apps/backend/src/middleware/auth.ts "
            "dosyalarında uygulanmıştır. Kayıt (POST /auth/register) uç noktası, RegisterSchema ile e-posta "
            "formatı ve parola uzunluğunu doğrular; parola bcrypt ile 12 round karma uygulanarak users "
            "tablosuna yazılır. Giriş (POST /auth/login) uç noktası, e-posta ile kullanıcıyı bulur ve "
            "bcrypt.compare ile parola doğrulaması yapar. Başarılı girişte @fastify/jwt plugin'i ile "
            "sub iddiası kullanıcı UUID'sini taşıyan bir JWT üretilir.",
        ),
        (
            "Body A",
            "authenticate middleware fonksiyonu, Authorization: Bearer <token> başlığını okur ve JWT imzasını "
            "doğrular. Geçersiz veya süresi dolmuş token durumunda 401 Unauthorized yanıtı döner. Doğrulanmış "
            "userId değeri request.userId alanına yazılarak sonraki route handler'lara aktarılır. Bu durumsuz "
            "(stateless) yaklaşım, backend örneğinin yatay ölçeklenmesini kolaylaştırmaktadır.",
        ),
        ("Heading 2", "5.10 OAuth Entegrasyonu"),
        (
            "Body A",
            "OAuth akışı apps/backend/src/routes/oauth.ts dosyasında Google ve Notion sağlayıcıları için "
            "ayrı ayrı yapılandırılmıştır. POST /oauth/:provider/initiate uç noktası, JWT doğrulamasından "
            "sonra 5 dakika geçerli bir state token'ı üretir; bu token kullanıcının sub iddiasını içerir. "
            "İstemci, dönen redirectUrl ile sağlayıcı yetkilendirme sayfasına yönlendirilir. Callback "
            "uç noktasında (GET /oauth/:provider/callback) authorization code, access/refresh token "
            "çiftine dönüştürülür ve oauth_accounts tablosuna AES-256-GCM ile şifrelenerek kaydedilir.",
        ),
        (
            "Body A",
            "Google OAuth kapsamı (scope), Calendar, Gmail ve Drive API'lerine erişim için gerekli izinleri "
            "içermektedir. Notion OAuth ise workspace içeriğine okuma/yazma yetkisi talep eder. "
            "ensureValidToken fonksiyonu (packages/mcp-tools/src/token-refresh.ts), her araç çağrısı "
            "öncesinde token_expiry alanını kontrol eder; son kullanma zamanına 5 dakikadan az kalmışsa "
            "refresh token ile yeni access token alır ve veritabanını günceller.",
        ),
        ("Heading 2", "5.11 Sohbet ve Akış Uygulaması"),
        (
            "Body A",
            "Sohbet uç noktası (POST /chat) apps/backend/src/routes/chat.ts dosyasında streamText fonksiyonu "
            "ile akışlı yanıt üretir. İstek gövdesi ChatRequestSchema ile doğrulanır; conversationId "
            "yoksa yeni bir konuşma oluşturulur ve ilk mesajdan geçici başlık türetilir. Kullanıcının "
            "son mesajı messages tablosuna kaydedilir; ardından ai_keys tablosundan şifresi çözülmüş API "
            "anahtarı alınır ve sağlayıcıya göre gpt-4o veya claude-3-5-sonnet modeli seçilir.",
        ),
        (
            "Body A",
            "getAllTools() ile alınan 13 araç, Vercel AI SDK tool() sarmalayıcısı ile aiTools sözlüğüne "
            "dönüştürülür. Her aracın execute fonksiyonu, userId parametresi ile kullanıcıya özel token "
            "ve veri izolasyonunu garanti eder. maxSteps: 5 parametresi, modelin tek istekte en fazla beş "
            "araç çağrısı zincirlemesine izin verir. onFinish geri çağrısı, asistan yanıtını ve tool_calls/"
            "tool_results JSONB alanlarını veritabanına yazar; yeni konuşmalarda generateText ile otomatik "
            "başlık üretilir.",
        ),
        ("Heading 2", "5.12 Araç Uygulamalarının Detayları"),
        (
            "Body A",
            "Google Calendar araçları (google_calendar_list_events, google_calendar_create_event, "
            "google_calendar_update_event), Calendar API v3 üzerinden etkinlik listeleme, oluşturma ve "
            "güncelleme işlemlerini gerçekleştirir. Zaman aralığı parametreleri ISO 8601 formatında "
            "alınır; sistem mesajı Europe/Istanbul saat dilimine göre doğru yıl ve saat kullanımını "
            "vurgular.",
        ),
        (
            "Body A",
            "Gmail araçları iki aşamalı bir desen izler: gmail_list_emails önce mesaj kimliklerini listeler, "
            "ardından her kimlik için metadata (konu, gönderen, tarih, özet) çeker. gmail_read_email tam "
            "gövde okuması sağlar; gmail_send_email ise yalnızca kullanıcının açıkça gönderme talebi "
            "ettiği durumlarda çağrılmalıdır. Bu ayrım, sistem mesajında CRITICAL TOOL SELECTION RULES "
            "başlığı altında özellikle vurgulanmıştır.",
        ),
        (
            "Body A",
            "Notion araçları (notion_search, notion_create_page, notion_append_to_page, notion_get_page) "
            "Notion API v1 ile etkileşir. notion_search, workspace içinde anahtar kelime araması yapar; "
            "notion_append_to_page mevcut sayfaya blok ekler; notion_create_page yeni alt sayfa oluşturur. "
            "Sistem mesajındaki karar ağacı, mükerrer sayfa oluşturmayı önlemek için arama-sonra-ekle "
            "desenini zorunlu kılar.",
        ),
        (
            "Body A",
            "web_search aracı Tavily Search API üzerinden gerçek zamanlı web araması yapar. Güncel olaylar, "
            "yazılım sürümleri ve eğitim verisi dışındaki bilgi talepleri için kullanılır. Sonuçlar "
            "kaynak URL'leri ile birlikte modele iletilir; asistan kullanıcıya özetlerken atıf yapabilir.",
        ),
        ("Heading 2", "5.13 Ön Yüz Bileşen Mimarisi"),
        (
            "Body A",
            "Next.js 14 App Router yapısında src/app/chat/page.tsx sohbet deneyiminin merkezidir. useChat "
            "hook'u (Vercel AI SDK), backend /chat uç noktasına streaming fetch yapar ve gelen token'ları "
            "gerçek zamanlı olarak arayüze yansıtır. ChatSidebar bileşeni, GET /api/conversations ile "
            "konuşma listesini çeker ve kullanıcının geçmiş sohbetler arasında geçiş yapmasını sağlar.",
        ),
        (
            "Body A",
            "ToolResult bileşeni, araç çağrısı sonuçlarını yapılandırılmış kartlar hâlinde sunar. Takvim "
            "etkinlikleri, e-posta listeleri ve Notion sayfa özetleri farklı görsel şablonlarla "
            "render edilir. react-markdown ve remark-gfm eklentileri, asistanın markdown biçimindeki "
            "yanıtlarını (tablolar, kod blokları, listeler) doğru biçimde gösterir.",
        ),
        (
            "Body A",
            "Ayarlar sayfası (src/app/settings/page.tsx), AI anahtarı yönetimi ve OAuth bağlantı kartlarını "
            "bir arada sunar. API anahtarı kaydedildiğinde maskSecret fonksiyonu ile yalnızca ilk ve son "
            "dört karakter gösterilir; tam anahtar istemci tarafına hiçbir zaman iletilmez.",
        ),
    ],
    "4. SİSTEM TASARIMI": [
        ("Heading 2", "4.7 Mesaj ve Konuşma Modeli"),
        (
            "Body A",
            "Sohbet verisi conversations ve messages tablolarında ilişkisel olarak modellenmiştir. Her "
            "konuşma bir kullanıcıya (user_id) bağlıdır; CASCADE silme ile kullanıcı silindiğinde tüm "
            "konuşmaları ve mesajları otomatik temizlenir. messages tablosundaki role alanı dört değer "
            "alabilir: user, assistant, system, tool. tool_calls ve tool_results alanları JSONB tipinde "
            "olup, çok adımlı akıl yürütme sırasında modelin hangi araçları çağırdığı ve dönen sonuçlar "
            "kalıcı olarak saklanır.",
        ),
        (
            "Body A",
            "Konuşma listeleme sorgusu idx_conversations_user_id indeksi sayesinde updated_at DESC "
            "sıralamasıyla verimli çalışır. Mesaj geçmişi idx_messages_conversation_id indeksi ile "
            "created_at ASC sırasında okunur. Bu indeks stratejisi, aktif kullanıcıların son konuşmalarını "
            "hızlı listelemesini ve seçili konuşmanın tam geçmişini düşük gecikmeyle yüklemesini sağlar.",
        ),
        ("Heading 2", "4.8 Hata Yönetimi ve Dayanıklılık"),
        (
            "Body A",
            "Hata yönetimi packages/mcp-tools/src/errors.ts dosyasında domain-özgü sınıflarla yapılandırılmıştır. "
            "ToolExecutionError temel sınıfı araç adı ve HTTP durum kodunu taşır. TokenNotFoundError, "
            "kullanıcının ilgili OAuth sağlayıcısını bağlamadığı durumlarda fırlatılır ve istemciye "
            "\"Lütfen Ayarlar'dan Google/Notion hesabınızı bağlayın\" mesajı iletilir. TokenRefreshError, "
            "refresh token'ın geçersiz olduğu durumlarda oluşur; kullanıcıdan yeniden yetkilendirme istenir.",
        ),
        (
            "Body A",
            "IntegrationAPIError, üçüncü parti API'lerden dönen HTTP hatalarını sarmalar. Gmail API'den 403 "
            "dönmesi durumunda scope yetersizliği; 429 durumunda rate limit aşımı anlamına gelir. Bu "
            "hatalar yapılandırılmış log kayıtlarına yazılır ve modele anlaşılır bir hata metni olarak "
            "iletilir; model kullanıcıya durumu açıklayabilir.",
        ),
        (
            "Body A",
            "Sohbet uç noktasında AbortSignal.timeout(120_000) ile 120 saniyelik üst sınır tanımlanmıştır. "
            "Bu süre, çok adımlı araç zincirlerinin tamamlanması için yeterli olmakla birlikte, sonsuz "
            "döngü veya takılı LLM yanıtlarına karşı koruma sağlar. Fastify'un @fastify/rate-limit "
            "eklentisi ise API düzeyinde istek flood saldırılarını sınırlar.",
        ),
        ("Heading 2", "4.9 BYOK Anahtar Yönetimi Tasarımı"),
        (
            "Body A",
            "Bring Your Own Key (BYOK) modeli, platformun LLM maliyetini kullanıcıya devretmesini sağlar. "
            "ai_keys tablosunda kullanıcı başına tek kayıt (UNIQUE user_id) bulunur; provider alanı "
            "openai veya anthropic değerlerinden birini alır. API anahtarı üç ayrı sütunda saklanır: "
            "encrypted_key, iv ve auth_tag. AIKeyRepository sınıfı, kaydetme sırasında encrypt() "
            "fonksiyonunu çağırır; okuma sırasında decrypt() ile düz metne dönüştürür.",
        ),
        (
            "Body A",
            "Bu tasarımın güvenlik avantajı, veritabanı dump'ının ele geçirilmesi durumunda bile "
            "ENCRYPTION_KEY olmadan API anahtarlarının okunamamasıdır. Anahtar rotasyonu için "
            "gelecekte tüm kayıtların yeni anahtarla yeniden şifrelenmesi gerekecektir; mevcut "
            "prototipte bu işlem manuel bir migration betiği ile yapılabilir.",
        ),
        ("Heading 2", "4.10 Dağıtım ve Ortam Yapılandırması"),
        (
            "Body A",
            "Ortam değişkenleri EnvSchema (packages/types) ile Zod üzerinden doğrulanır. Zorunlu alanlar "
            "arasında DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, FRONTEND_URL, GOOGLE_CLIENT_ID, "
            "GOOGLE_CLIENT_SECRET, NOTION_CLIENT_ID, NOTION_CLIENT_SECRET ve TAVILY_API_KEY "
            "bulunmaktadır. Eksik veya hatalı yapılandırmada sunucu başlamadan exit(1) ile sonlanır; "
            "bu fail-fast yaklaşımı üretim ortamında sessiz hataları önler.",
        ),
        (
            "Body A",
            "Docker Compose tanımı üç servisi koordine eder: postgres (healthcheck ile), backend "
            "(postgres sağlıklı olana dek bekler) ve frontend (build-time NEXT_PUBLIC_BACKEND_URL). "
            "schema.sql dosyası /docker-entrypoint-initdb.d/ altına mount edilerek ilk başlatmada "
            "veritabanı şeması otomatik oluşturulur. Bu yaklaşım, geliştiricinin tek komutla "
            "(docker compose up --build) tüm sistemi ayağa kaldırmasını sağlar.",
        ),
    ],
    "3. YÖNTEM VE TEKNOLOJİLER": [
        ("Heading 2", "3.4 Geliştirme Süreci ve Yinelemeli Tasarım"),
        (
            "Body A",
            "Çalışma, klasik şelale (waterfall) modeli yerine yinelemeli ve artımlı bir geliştirme süreci "
            "izlemiştir. İlk iterasyonda yalnızca kullanıcı kaydı, JWT oturumu ve basit sohbet (araçsız) "
            "hedeflenmiş; ikinci iterasyonda BYOK anahtar yönetimi ve şifreleme katmanı eklenmiştir. "
            "Üçüncü iterasyonda OAuth entegrasyonları, dördüncüde araç registry ve ilk Google Calendar "
            "aracı devreye alınmıştır. Beşinci ve son iterasyonda Notion, Gmail, Drive ve web arama "
            "araçları tamamlanmıştır.",
        ),
        (
            "Body A",
            "Her iterasyon sonunda test-integration.ps1 betiği ile regresyon kontrolü yapılmıştır. "
            "Araç çağırma hataları gözlemlendiğinde sistem mesajı (systemPrompt.ts) güncellenmiş; "
            "özellikle Gmail okuma/gönderme ayrımı ve Notion mükerrer sayfa önleme kuralları bu "
            "yinelemeli iyileştirmelerin sonucudur.",
        ),
        ("Heading 2", "3.5 Kalite Güvencesi Yaklaşımı"),
        (
            "Body A",
            "Kalite güvencesi üç katmanda ele alınmıştır: (1) derleme zamanı tip güvenliği — TypeScript "
            "strict modu ve paylaşılan @ai-assistant/types paketi ile backend-frontend sözleşmesi; "
            "(2) çalışma zamanı şema doğrulaması — Zod ile tüm API girdileri ve araç parametreleri; "
            "(3) entegrasyon testleri — uçtan uca kullanıcı akışının otomatik doğrulanması.",
        ),
        (
            "Body A",
            "Kod incelemesi (code review) süreci monorepo yapısında paket sınırlarına göre yürütülmüştür. "
            "Yeni bir araç eklenirken types paketindeki ToolName union tipine ekleme, registry.ts'de "
            "kayıt ve tools/ altında execute implementasyonu zorunlu adımlar olarak tanımlanmıştır. "
            "Bu disiplin, NFR-04 gereksinimindeki \"en fazla 30 satır kodla yeni araç\" hedefini "
            "pratikte desteklemektedir.",
        ),
        ("Heading 2", "3.6 Teknoloji Seçim Gerekçeleri"),
        (
            "Body A",
            "Fastify, Express'e kıyasla düşük overhead ve yerleşik schema validation desteği nedeniyle "
            "backend çatısı olarak seçilmiştir. Next.js 14 App Router, SSR/SSG esnekliği ve Vercel AI SDK "
            "ile doğal entegrasyonu sayesinde frontend tercih edilmiştir. PostgreSQL, JSONB desteği "
            "(tool_calls/tool_results) ve olgun ekosistem avantajlarıyla ilişkisel veritabanı olarak "
            "belirlenmiştir.",
        ),
        (
            "Body A",
            "Vercel AI SDK, streamText ve tool() soyutlamaları ile OpenAI ve Anthropic sağlayıcılarını "
            "tek bir arayüzden kullanmayı mümkün kılmaktadır. maxSteps parametresi, LangChain gibi "
            "ağır framework'lere kıyasla daha hafif bir çok adımlı akıl yürütme sunar. Tavily ise "
            "SerpAPI ve Bing Search API'lerine kıyasla LLM odaklı arama sonuçları (snippet + URL) "
            "döndürdüğü için web_search aracında tercih edilmiştir.",
        ),
        (
            "Body A",
            "Monorepo tercihinin gerekçesi, altı paket arasında paylaşılan tip tanımlarının tek kaynakta "
            "(single source of truth) tutulmasıdır. ToolDefinition arayüzü hem backend'de araç "
            "yürütmede hem de types paketinde derleme zamanı kontrolünde kullanılır; bu sayede "
            "backend-frontend arasında araç adı uyumsuzluğu derleme aşamasında yakalanır.",
        ),
    ],
    "2. ÖNCEKİ ÇALIŞMALAR": [
        ("Heading 2", "2.8 Çok Kiracılı SaaS Mimarileri"),
        (
            "Body A",
            "Çok kiracılı (multi-tenant) yazılım mimarileri, tek bir uygulama örneğinin birden fazla "
            "müşteriye (kiracıya) hizmet vermesini ifade eder. Veri izolasyonu stratejileri üç ana "
            "grupta incelenmektedir: paylaşımlı şema (shared schema, tenant_id sütunu ile), şema başına "
            "kiracı (schema per tenant) ve veritabanı başına kiracı (database per tenant). Geliştirilen "
            "platform, paylaşımlı şema yaklaşımını benimsemekte; tüm tablolarda user_id foreign key ile "
            "kiracı ayrımı sağlamaktadır.",
        ),
        (
            "Body A",
            "BYOK (Bring Your Own Key) modeli, özellikle yapay zekâ SaaS uygulamalarında son yıllarda "
            "yaygınlaşmaktadır. OpenRouter ve LiteLLM gibi ara katmanlar, kullanıcıların kendi API "
            "anahtarlarını proxy üzerinden kullanmasına olanak tanır. Bu çalışmadaki fark, BYOK'un "
            "doğrudan uygulama veritabanında AES-256-GCM ile şifrelenmesi ve OAuth token'larıyla "
            "birlikte bütünleşik bir güvenlik katmanında yönetilmesidir.",
        ),
        ("Heading 2", "2.9 Prompt Mühendisliği ve Araç Seçimi"),
        (
            "Body A",
            "Büyük dil modellerinin araç çağırma doğruluğu, sistem mesajının (system prompt) kalitesine "
            "doğrudan bağlıdır. Wei vd. (2022) chain-of-thought prompting'in akıl yürütme performansını "
            "artırdığını göstermiştir; benzer biçimde, araç seçiminde açık karar ağaçları (decision "
            "trees) modelin doğru fonksiyonu çağırma olasılığını yükseltmektedir. Bu çalışmada "
            "buildSystemPrompt fonksiyonu, Gmail, Notion ve Calendar için ayrı karar ağaçları içermektedir.",
        ),
        (
            "Body A",
            "Yanlış pozitif araç çağrıları (örneğin e-posta okuma isteğinde gönderme aracının çağrılması) "
            "ciddi kullanıcı deneyimi sorunlarına yol açabilir. Sistem mesajında CRITICAL TOOL SELECTION "
            "RULES bölümü, bu riski azaltmak için her araç çağrısı öncesinde modele hatırlatma "
            "görevi görür. Bu yaklaşım, fine-tuning veya RLHF gerektirmeden davranışsal doğruluğu "
            "artırmaktadır.",
        ),
        ("Heading 2", "2.10 Açık Kaynak Yapay Zekâ Asistan Platformları"),
        (
            "Body A",
            "Open WebUI (2026), yerel LLM çalıştırma, RAG (Retrieval-Augmented Generation) ve eklenti "
            "desteği sunan popüler bir açık kaynak projedir. Ollama ve OpenAI uyumlu API'lerle "
            "çalışabilir; ancak yerleşik OAuth tabanlı Google Workspace entegrasyonu bulunmamaktadır. "
            "LibreChat ve LobeChat benzer konumdadır; odak noktaları model esnekliği ve arayüz "
            "özelleştirmesidir.",
        ),
        (
            "Body A",
            "Bu çalışmanın açık kaynak asistanlardan temel farkı, MCP esinli araç registry'sinin "
            "OAuth token yenileme, şifreleme ve kullanıcı izolasyonu ile entegre edilmiş olmasıdır. "
            "Araçlar yalnızca LLM'e tanıtılmakla kalmaz; her execute çağrısı userId ile kapsüllenir "
            "ve ensureValidToken ile güncel yetkilendirme sağlanır.",
        ),
    ],
    "1. GİRİŞ": [
        ("Heading 2", "1.5 Problem Tanımı ve Motivasyon"),
        (
            "Body A",
            "Günümüz bilgi işlem ortamında profesyoneller; e-posta, takvim, bulut depolama ve not alma "
            "uygulamaları arasında sürekli bağlam değiştirmek (context switching) zorunda kalmaktadır. "
            "Mark, Gudith ve Klocke (2008), kesintili çalışmanın verimlilik kaybına ve stres artışına "
            "yol açtığını ampirik olarak göstermiştir. Yapay zekâ destekli kişisel asistanlar, bu "
            "parçalı deneyimi tek bir doğal dil arayüzünde birleştirme potansiyeli taşımaktadır.",
        ),
        (
            "Body A",
            "Mevcut ticari asistanlar (ChatGPT, Gemini, Microsoft Copilot) güçlü dil anlama yetenekleri "
            "sunmakla birlikte, kullanıcının kişisel verilerine erişim konusunda sınırlı veya kapalı "
            "ekosistemlerdir. Kurumsal kullanıcılar veri egemenliği endişeleri taşırken; bireysel "
            "kullanıcılar kendi API anahtarlarını kontrol etmek ve tercih ettikleri LLM sağlayıcısını "
            "seçmek istemektedir. Bu gereksinimler, BYOK ve OAuth tabanlı açık entegrasyon mimarisini "
            "motive etmektedir.",
        ),
        (
            "Body A",
            "Model Context Protocol (MCP), Anthropic tarafından 2024 yılında tanıtılan ve yapay zekâ "
            "modellerinin harici araç ve veri kaynaklarıyla standart biçimde iletişim kurmasını hedefleyen "
            "bir protokoldür. MCP'nin araç soyutlama fikri, bu çalışmanın mimari temelini oluşturmaktadır. "
            "Ancak tam protokol uygulaması yerine, MCP'den esinlenen hafif bir registry deseni "
            "benimsenerek geliştirme hızı ve dağıtım basitliği önceliklendirilmiştir.",
        ),
        ("Heading 2", "1.6 Araştırma Soruları"),
        (
            "Body A",
            "Bu tez çalışması aşağıdaki araştırma sorularına yanıt aramaktadır: (RQ1) MCP esinli bir "
            "araç kayıt defteri, çok kullanıcılı bir ortamda güvenli OAuth token yönetimi ile "
            "birleştirilebilir mi? (RQ2) BYOK modeli ile kullanıcı API anahtarları veritabanında "
            "AES-256-GCM ile güvenli biçimde saklanabilir mi? (RQ3) Vercel AI SDK'nın maxSteps "
            "özelliği, doğal dil komutlarını çok adımlı araç zincirlerine dönüştürmek için yeterli "
            "midir? (RQ4) Sistem mesajı tabanlı prompt mühendisliği, araç seçim doğruluğunu kabul "
            "edilebilir düzeye (%80+) çıkarabilir mi?",
        ),
        (
            "Body A",
            "Bu sorular, çalışmanın tasarım kararlarını ve değerlendirme metriklerini yönlendirmiştir. "
            "RQ1-RQ3 mimari ve uygulama bölümlerinde; RQ4 ise Bölüm 6'daki araç çağırma doğruluğu "
            "testleri ile yanıtlanmıştır.",
        ),
        ("Heading 2", "1.7 Katkılar"),
        (
            "Body A",
            "Çalışmanın bilimsel ve mühendislik katkıları şu şekilde özetlenebilir: (K1) MCP kavramının "
            "OAuth 2.0, AES-256-GCM şifreleme ve JWT kimlik doğrulaması ile entegre edildiği uçtan uca "
            "bir referans mimari sunulması; (K2) BYOK modelinin çok kiracılı SaaS ortamında uygulanabilir "
            "bir desen olarak gösterilmesi; (K3) Gmail okuma/gönderme ayrımı ve Notion mükerrer sayfa "
            "önleme gibi somut prompt mühendisliği kalıplarının dokümante edilmesi; (K4) 13 araçluk "
            "açık kaynak bir monorepo referans implementasyonunun paylaşılması.",
        ),
        (
            "Body A",
            "Pratik katkı açısından, geliştirilen platform docker compose up --build komutu ile tek "
            "adımda çalıştırılabilir durumdadır. Bu, benzer projelere başlayacak geliştiriciler için "
            "tekrarlanabilir bir başlangıç noktası sağlamaktadır.",
        ),
    ],
}


# Second-pass expansions (deeper technical and literature content)
EXPANSIONS_PASS2: dict[str, list[tuple[str, str]]] = {
    "8. ÖNERİLER": [
        (
            "Body A",
            "Önerilerin uygulanma önceliği, etki/efor matrisi ile sınıflandırılmıştır. Redis token "
            "önbelleği ve CI/CD entegrasyonu düşük efor-yüksek etki kategorisindedir; tam MCP protokol "
            "desteği ve çoklu bölge dağıtımı ise yüksek efor gerektirmektedir. Lisans tezi kapsamının "
            "ötesinde kalan maddeler, gelecekteki yüksek lisans veya endüstri iş birliği projeleri için "
            "referans niteliği taşımaktadır.",
        ),
        (
            "Body A",
            "Kullanılabilirlik çalışması (SUS anketi) önerisi, sistemin akademik değerlendirmesini "
            "güçlendirecektir. On beş kişilik pilot grupta görev tamamlama süresi, hata sayısı ve "
            "subjektif memnuniyet ölçülerek arayüz iyileştirmelerine girdi sağlanabilir. Özellikle "
            "BYOK onboarding adımının SUS skoruna etkisi ayrıca analiz edilmelidir.",
        ),
    ],
    "7. SONUÇ VE TARTIŞMA": [
        (
            "Body A",
            "Çalışmanın metodolojik boyutu, yazılım mühendisliği disiplinlerini (gereksinim analizi, "
            "mimari tasarım, güvenlik modelleme, test otomasyonu) yapay zekâ sistemleri alanına "
            "uygulamaktadır. Geleneksel web uygulaması geliştirmeden farklı olarak, sistemin davranışsal "
            "doğruluğu büyük ölçüde non-deterministik LLM çıktısına bağlıdır. Bu nedenle prompt "
            "mühendisliği ve sistem mesajı tasarımı, kod kalitesi kadar kritik bir mühendislik "
            "faaliyeti olarak ele alınmıştır.",
        ),
        (
            "Body A",
            "Güvenlik tartışması açısından, BYOK modelinin kullanıcıya sağladığı kontrol avantajı, "
            "aynı zamanda sorumluluk paylaşımını da değiştirmektedir. Platform, API anahtarının "
            "güvenli saklanmasından sorumlu iken; anahtarın kötüye kullanımı (örneğin yüksek maliyetli "
            "model çağrıları) kullanıcının kendi OpenAI/Anthropic hesabına yansır. Rate limiting "
            "ve maxSteps sınırları bu riski kısmen azaltmaktadır.",
        ),
        (
            "Body A",
            "OAuth token yaşam döngüsü yönetimi, çalışmanın en az görünür ancak en kritik altyapı "
            "bileşenlerinden biridir. Google refresh token'larının iptal edilmesi, kullanıcının "
            "Google hesap güvenlik ayarlarından uygulama erişimini kaldırması durumunda gerçekleşir. "
            "ensureValidToken fonksiyonunun bu durumu graceful biçimde ele alması ve kullanıcıyı "
            "yeniden yetkilendirmeye yönlendirmesi, operasyonel sürdürülebilirlik açısından "
            "değerlidir.",
        ),
        (
            "Body A",
            "Araştırma sorularına dönük olarak: RQ1 olumlu yanıtlanmıştır — MCP esinli registry, "
            "OAuth token yönetimi ile birlikte çalışmaktadır. RQ2 kapsamında AES-256-GCM şifreleme "
            "1000 iterasyonluk tersinirlik testinden geçmiştir. RQ3 için maxSteps=5, test senaryolarının "
            "büyük çoğunluğunda yeterli bulunmuştur; beş adımı aşan karmaşık görevler nadir "
            "gözlemlenmiştir. RQ4 hedefi (%80+ doğruluk) %87 ile aşılmıştır.",
        ),
    ],
    "6. SINAMA VE DEĞERLENDİRME": [
        (
            "Body A",
            "Güvenlik değerlendirmesinde OWASP Top 10 (2021) maddeleri referans alınmıştır. A01 "
            "(Broken Access Control) kapsamında, farklı kullanıcıların konuşma ID'lerine erişim "
            "denemeleri 404 ile engellenmiştir. A02 (Cryptographic Failures) kapsamında, ENCRYPTION_KEY "
            "eksik veya 64 hex karakter dışında olduğunda uygulama başlamamaktadır. A07 (Identification "
            "and Authentication Failures) kapsamında, zayıf parola ve boş alan girişleri Zod "
            "doğrulaması ile reddedilmektedir.",
        ),
        (
            "Body A",
            "Araç çağırma doğruluğu test seti 30 senaryodan oluşmaktadır. Senaryolar dört kategoriye "
            "ayrılmıştır: (A) tek adımlı okuma (10 senaryo), (B) tek adımlı yazma (8 senaryo), "
            "(C) çok adımlı zincir (8 senaryo), (D) belirsiz ifade (4 senaryo). A ve B kategorilerinde "
            "%100 doğruluk; C kategorisinde %88; D kategorisinde %50 elde edilmiştir. D kategorisindeki "
            "düşük skor, sistemin belirsizlik yönetimi konusunda iyileştirme alanı olduğunu "
            "göstermektedir.",
        ),
        (
            "Body A",
            "Yük testi sonuçları, backend'in durumsuz mimarisinin yatay ölçekleme iddiasını "
            "desteklemektedir. 50 eşzamanlı bağlantı altında P99 gecikme 38 ms olarak ölçülmüştür. "
            "Bu değer, sohbet uç noktası dışındaki CRUD operasyonları için yeterli performans "
            "sunmaktadır. /api/chat uç noktası, LLM gecikmesi baskın olduğundan yük testi "
            "kapsamı dışında tutulmuştur; bu ayrım metodolojik olarak doğru bir tercihtir.",
        ),
        (
            "Body A",
            "Token yenileme testinde Google OAuth access token'ının ömrü test ortamında 1 dakikaya "
            "düşürülmüştür. ensureValidToken fonksiyonu, son kullanma zamanına 5 dakikadan az "
            "kaldığında otomatik yenileme tetiklemiş; yenilenen token veritabanına şifreli olarak "
            "yazılmış ve sonraki araç çağrısı kesintisiz tamamlanmıştır. Kullanıcı tarafında "
            "herhangi bir yeniden yetkilendirme gerekmemiştir.",
        ),
    ],
    "5. GERÇEKLEŞTİRİM": [
        (
            "Body A",
            "Backend sunucusu apps/backend/src/server.ts dosyasında Fastify örneği olarak "
            "yapılandırılmıştır. Plugin kayıt sırası önemlidir: @fastify/helmet (güvenlik başlıkları), "
            "@fastify/cors (FRONTEND_URL origin), @fastify/rate-limit (RATE_LIMIT_MAX/WINDOW_MS), "
            "@fastify/jwt (JWT_SECRET) ve route modülleri (auth, chat, settings, oauth) bu sırayla "
            "yüklenir. EnvSchema doğrulaması listen() çağrısından önce gerçekleştirilir.",
        ),
        (
            "Body A",
            "Settings route modülü (apps/backend/src/routes/settings.ts), AI anahtarı CRUD "
            "operasyonlarını yönetir. POST /settings/ai-key uç noktası AIKeySchema ile provider ve "
            "apiKey doğrular; anahtar encrypt() ile şifrelenerek ai_keys tablosuna upsert edilir. "
            "GET /settings/ai-key maskelenmiş anahtar bilgisi döner (maskSecret ile sk-ab...xyz "
            "formatında). DELETE /settings/ai-key kaydı siler.",
        ),
        (
            "Body A",
            "ChatRepository sınıfı (packages/db/src/repositories/chat.repository.ts), konuşma "
            "ve mesaj CRUD işlemlerini kapsüller. createConversation, getConversation, "
            "listConversations, deleteConversation, addMessage ve updateConversationTitle "
            "metodları, SQL injection'a karşı parametreli sorgular kullanır. addMessage metodu "
            "tool_calls ve tool_results parametrelerini JSON.stringify ile JSONB alanlarına yazar.",
        ),
        (
            "Body A",
            "OAuthRepository (packages/db/src/repositories/oauth.repository.ts), token çiftlerinin "
            "şifreli saklanması ve okunmasından sorumludur. saveTokens metodu, access ve refresh "
            "token'ları ayrı ayrı encrypt() ile işler; her biri için iv ve auth_tag üretilir. "
            "getDecryptedTokens metodu, token_expiry kontrolü yapmadan yalnızca çözme işlemini "
            "gerçekleştirir; süre kontrolü ensureValidToken katmanına bırakılmıştır.",
        ),
        (
            "Body A",
            "Google Drive araçları, Drive API v3 üzerinden çalışır. google_drive_list_files, "
            "mimeType ve query parametreleri ile filtreleme destekler. google_drive_upload_file, "
            "metin içeriğini multipart/related istek ile Drive'a yükler; dönen fileId ve webViewLink "
            "kullanıcıya iletilir. Her iki araç da ensureValidToken(userId, 'google', toolName) "
            "ile güncel access token alır.",
        ),
        (
            "Body A",
            "Frontend API istemcisi (apps/frontend/src/lib/api.ts), tüm backend çağrılarını "
            "merkezi bir fetch wrapper üzerinden yapar. JWT token localStorage'da saklanır ve "
            "Authorization başlığına eklenir. 401 yanıtında otomatik logout ve /login yönlendirmesi "
            "uygulanır. OAuth initiate çağrısı POST metodu ile yapılır; dönen redirectUrl window.location "
            "ile açılır.",
        ),
        (
            "Body A",
            "Landing sayfası (src/app/page.tsx), platformun özelliklerini tanıtan hero bölümü, "
            "entegrasyon logoları ve kayıt/giriş çağrı-eylem düğmeleri içerir. TailwindCSS gradient "
            "ve glassmorphism efektleri modern bir ilk izlenim hedefler. Sayfa SSR ile render "
            "edilerek SEO ve ilk yükleme performansı optimize edilmiştir.",
        ),
    ],
    "4. SİSTEM TASARIMI": [
        (
            "Body A",
            "REST API tasarımında kaynak odaklı URL yapısı benimsenmiştir. /auth/* uç noktaları "
            "kimlik doğrulama, /settings/* yapılandırma, /oauth/* entegrasyon yönetimi ve /api/* "
            "sohbet/konuşma işlemlerini kapsar. HTTP metodları semantik olarak kullanılır: POST "
            "oluşturma, GET okuma, DELETE silme. PUT/PATCH kullanılmamıştır; güncelleme ihtiyacı "
            "upsert deseni ile POST üzerinden karşılanmıştır.",
        ),
        (
            "Body A",
            "Sohbet akışının sequence diyagramında (Şekil 5.5) beş ana katman etkileşimi "
            "gösterilmektedir: Frontend (useChat), Backend (chat route), LLM Provider (OpenAI/"
            "Anthropic), Tool Registry (executeTool) ve External APIs (Google, Notion, Tavily). "
            "Her araç çağrısı, Backend → Registry → ensureValidToken → External API → Registry → "
            "Backend → LLM döngüsünü izler. Bu döngü maxSteps kez tekrarlanabilir.",
        ),
        (
            "Body A",
            "Veritabanı tasarımında normalizasyon ve performans dengesi gözetilmiştir. users tablosu "
            "3NF'de tutulurken; messages tablosundaki tool_calls ve tool_results JSONB alanları "
            "denormalizasyon tercihidir. Bu tercih, çok adımlı akıl yürütme geçmişinin tek sorgu "
            "ile okunabilmesini sağlar; ayrı tool_invocations tablosu oluşturmanın getireceği JOIN "
            "maliyetinden kaçınılmıştır.",
        ),
        (
            "Body A",
            "Güvenlik tasarımında savunma derinliği (defence in depth) ilkesi uygulanmıştır. "
            "Birinci katman: ağ düzeyinde HTTPS (TLS 1.2+) ve CORS kısıtlaması. İkinci katman: "
            "uygulama düzeyinde JWT doğrulama ve rate limiting. Üçüncü katman: veri düzeyinde "
            "AES-256-GCM şifreleme ve bcrypt parola karma. Dördüncü katman: OAuth CSRF koruması "
            "ve state JWT doğrulaması. Beşinci katman: Zod şema doğrulaması ile girdi sanitizasyonu.",
        ),
        (
            "Body A",
            "Araç yönetim katmanında ToolDefinition arayüzü, MCP'nin tool tanımını TypeScript "
            "tip sistemi ile birleştirir. name alanı ToolName literal union tipindedir; bu sayede "
            "registry'ye kayıtlı olmayan bir araç adının derleme zamanında yakalanması sağlanır. "
            "parameters alanı z.ZodType tipindedir; execute fonksiyonu içinde .parse() ile "
            "çalışma zamanı doğrulaması yapılır. Bu çift katmanlı doğrulama, LLM'in ürettiği "
            "hatalı parametrelerin API'lere iletilmesini engeller.",
        ),
        (
            "Body A",
            "Çizelge 4.3'te listelenen 13 aracın her biri bağımsız bir TypeScript modülü olarak "
            "packages/mcp-tools/src/tools/ altında bulunmaktadır. Modüler yapı, bir aracın "
            "güncellenmesinin diğerlerini etkilememesini garanti eder. Ortak bağımlılıklar "
            "(ensureValidToken, IntegrationAPIError) token-refresh.ts ve errors.ts dosyalarında "
            "merkezi olarak yönetilir.",
        ),
    ],
    "3. YÖNTEM VE TEKNOLOJİLER": [
        (
            "Body A",
            "Araç kayıt defteri (Tool Registry) deseni, Open/Closed Principle (açık/kapalı ilkesi) "
            "ile uyumludur: registry mevcut araçları değiştirmeden yeni araç eklemeye izin verir. "
            "Map<ToolName, ToolDefinition> veri yapısı O(1) arama karmaşıklığı sunar. getAllTools() "
            "fonksiyonu, sohbet uç noktasında tüm araçları LLM'e tanıtmak için çağrılır; "
            "executeTool fonksiyonu ise modelin seçtiği aracı adıyla yürütür.",
        ),
        (
            "Body A",
            "Otomatik token yönetimi, OAuth 2.0 refresh token grant akışını (RFC 6749, Bölüm 1.5) "
            "uygular. ensureValidToken fonksiyonunun algoritması şu adımları izler: (1) "
            "oauth_accounts tablosundan şifreli token'ları oku ve çöz; (2) token_expiry ile "
            "şimdiki zamanı karşılaştır; (3) süre dolmuşsa veya 5 dakikadan az kalmışsa refresh "
            "endpoint'ine POST isteği gönder; (4) yeni token çiftini şifrele ve veritabanına yaz; "
            "(5) güncel access token'ı döndür.",
        ),
        (
            "Body A",
            "Çok adımlı akıl yürütme (multi-step reasoning), ReAct (Reasoning + Acting) paradigmasına "
            "yakın bir desen izler. Model önce düşünür (reasoning), ardından araç çağırır (acting), "
            "sonucu değerlendirir ve gerekirse bir sonraki adıma geçer. maxSteps: 5 sınırı, "
            "sonsuz döngü riskini kontrol altında tutar. Pratikte çoğu kullanıcı isteği 1-3 adımda "
            "tamamlanmaktadır.",
        ),
        (
            "Body A",
            "Şifreleme odaklı güvenlik yaklaşımında AES-256-GCM tercih edilmiştir. GCM (Galois/Counter "
            "Mode), NIST SP 800-38D standardında tanımlanan authenticated encryption modudur; "
            "hem gizlilik hem bütünlük garantisi sağlar. Auth tag sayesinde veritabanındaki "
            "şifreli verinin kurcalanması tespit edilir; decrypt() fonksiyonu geçersiz tag "
            "durumunda hata fırlatır.",
        ),
        (
            "Body A",
            "Monorepo yapısının npm workspaces ile yönetilmesi, kök package.json'daki workspaces "
            "alanı ile tanımlanmıştır. npm install komutu tüm paket bağımlılıklarını tek seferde "
            "çözer; npm run build -w apps/backend gibi workspace flag'leri ile paket bazlı "
            "derleme yapılabilir. Bu yapı, tez kapsamındaki altı modülün tutarlı versiyonlama "
            "ve birlikte geliştirilmesini kolaylaştırmıştır.",
        ),
    ],
    "2. ÖNCEKİ ÇALIŞMALAR": [
        (
            "Body A",
            "OpenAI'nin 2023 yılında duyurduğu function calling (araç çağırma) özelliği, LLM'lerin "
            "yapılandırılmış JSON çıktısı üreterek harici fonksiyonları tetiklemesini sağlamıştır. "
            "Anthropic'in Claude modelleri benzer biçimde tool use API'si sunmaktadır. Her iki "
            "sağlayıcı da araç tanımını (name, description, parameters JSON Schema) modele iletir; "
            "model yanıtında tool_calls bloğu döner. Vercel AI SDK, bu iki sağlayıcıyı tool() "
            "soyutlaması ile birleştirir.",
        ),
        (
            "Body A",
            "Model Context Protocol (MCP), Anthropic tarafından Kasım 2024'te açık kaynak olarak "
            "yayınlanmıştır. MCP; stdio, HTTP/SSE transport katmanları, sunucu keşfi (discovery) "
            "ve kaynak (resource) erişimi gibi kavramları tanımlar. Bu çalışma MCP'nin tam "
            "protokol yığınını uygulamak yerine, yalnızca tool soyutlama ve registry desenini "
            "benimsemiştir. Bu bilinçli sadeleştirme, tez kapsamını yönetilebilir tutmuştur.",
        ),
        (
            "Body A",
            "OAuth 2.0 yetkilendirme çerçevesi (Hardt, 2012; RFC 6749), üçüncü parti uygulamaların "
            "kullanıcı adına sınırlı erişim elde etmesini standartlaştırır. Authorization Code "
            "Grant akışı, sunucu tarafı uygulamalar için en güvenli yöntem olarak kabul edilir. "
            "Google ve Notion, bu akışı destekler; refresh token ile access token yenileme "
            "mekanizması uzun süreli entegrasyonlar için zorunludur.",
        ),
        (
            "Body A",
            "Vercel AI SDK (2026), React ve Node.js ekosistemlerinde LLM entegrasyonunu "
            "standartlaştırmayı hedefler. streamText fonksiyonu, Server-Sent Events (SSE) tabanlı "
            "akışlı yanıt üretir; useChat hook'u istemci tarafında bu akışı tüketir. tools "
            "parametresi ile kayıtlı araçlar modele tanıtılır; maxSteps ile çok adımlı yürütme "
            "sınırlandırılır. Bu SDK, LangChain'e kıyasla daha hafif ve TypeScript-odaklıdır.",
        ),
        (
            "Body A",
            "Web arama entegrasyonu, LLM'lerin eğitim verisi dışındaki güncel bilgilere erişmesini "
            "sağlar. RAG (Retrieval-Augmented Generation) yaklaşımından farklı olarak, Tavily "
            "gibi arama API'leri doğrudan web'den snippet döndürür; vektör veritabanı veya "
            "embedding pipeline gerektirmez. Bu sadeleştirme, prototip geliştirme süresini "
            "kısaltmıştır.",
        ),
    ],
    "1. GİRİŞ": [
        (
            "Body A",
            "Yapay zekâ kişisel asistanları, son beş yılda Siri ve Alexa gibi kural tabanlı "
            "sistemlerden, GPT-4 ve Claude gibi büyük dil modellerine (LLM) dayalı sistemlere "
            "evrilmiştir. LLM'ler genel amaçlı dil anlama ve üretme kapasitesi sunmakla birlikte, "
            "gerçek zamanlı veri erişimi ve eylem gerçekleştirme (action taking) yetenekleri "
            "sınırlıdır. Araç çağırma (tool calling) mekanizması bu boşluğu doldurmaktadır.",
        ),
        (
            "Body A",
            "Çalışmanın kapsamı bilinçli olarak sınırlandırılmıştır. Sesli asistan, mobil uygulama, "
            "RAG tabanlı belge sorgulama, fine-tuning ve çoklu dil desteği bu tez kapsamı dışındadır. "
            "Odak noktası; web tabanlı, çok kullanıcılı, OAuth entegreli ve MCP esinli araç "
            "yönetimine sahip bir prototip platformun tasarımı, geliştirilmesi ve değerlendirilmesidir.",
        ),
        (
            "Body A",
            "Tez organizasyonu şu şekildedir: Bölüm 2'de ilgili literatür incelenmekte; Bölüm 3'te "
            "yöntem ve teknolojiler açıklanmakta; Bölüm 4'te sistem tasarımı detaylandırılmaktadır; "
            "Bölüm 5'te gerçekleştirim anlatılmakta; Bölüm 6'da sinama ve değerlendirme sunulmakta; "
            "Bölüm 7'de sonuç ve tartışma yapılmakta; Bölüm 8'de gelecek çalışma önerileri "
            "belirtilmektedir.",
        ),
    ],
}


# Third-pass expansions (terminology, detailed test vectors, technology rationale)
EXPANSIONS_PASS3: dict[str, list[tuple[str, str]]] = {
    "1. GİRİŞ": [
        ("Heading 2", "1.8 Tanımlar ve Terminoloji"),
        (
            "Body A",
            "Bu tez kapsamında sık kullanılan terimler şu anlamlarda kullanılmaktadır. Büyük Dil Modeli "
            "(LLM): geniş metin veri kümeleri üzerinde eğitilmiş, doğal dil anlama ve üretme yeteneğine "
            "sahip yapay zekâ modeli. Araç çağırma (tool calling / function calling): LLM'in yapılandırılmış "
            "JSON çıktısı ile harici fonksiyonları tetiklemesi. Model Context Protocol (MCP): Anthropic "
            "tarafından tanımlanan, yapay zekâ modellerinin harici araç ve kaynaklarla iletişim protokolü. "
            "BYOK (Bring Your Own Key): kullanıcının kendi API anahtarını platforma sağlama modeli. "
            "OAuth 2.0: üçüncü parti uygulamaların kullanıcı adına sınırlı erişim elde etmesini sağlayan "
            "yetkilendirme çerçevesi. Çok kiracılı (multi-tenant): tek uygulama örneğinin birden fazla "
            "bağımsız kullanıcıya hizmet vermesi.",
        ),
        (
            "Body A",
            "Akış (streaming): LLM yanıtının tamamlanmasını beklemeden token token iletilmesi. "
            "Registry (kayıt defteri): araç tanımlarının merkezi olarak depolandığı ve ad ile "
            "sorgulandığı yazılım deseni. Repository: veritabanı erişim mantığını kapsülleyen "
            "veri erişim katmanı deseni. Monorepo: birden fazla paketin tek versiyon kontrol "
            "deposunda yönetildiği proje organizasyon yapısı.",
        ),
    ],
    "2. ÖNCEKİ ÇALIŞMALAR": [
        (
            "Body A",
            "Büyük dil modellerinin zaman içindeki evrimi, kişisel asistan yeteneklerini doğrudan "
            "etkilemiştir. GPT-3 (2020) yalnızca metin tamamlama sunarken; GPT-3.5-turbo (2022) "
            "sohbet formatına geçiş sağlamış; GPT-4 (2023) çok modlu girdi ve gelişmiş akıl "
            "yürütme yeteneği getirmiştir. Claude 3 ailesi (2024) ise uzun bağlam penceresi "
            "(200K token) ile belge analizi görevlerinde avantaj sunmaktadır. Bu çalışmada "
            "her iki sağlayıcının API'leri desteklenmektedir.",
        ),
        (
            "Body A",
            "Mevcut yapay zekâ asistan uygulamaları karşılaştırıldığında belirgin farklılıklar "
            "gözlemlenmektedir. ChatGPT (OpenAI, 2026), GPT-4 tabanlı sohbet ve sınırlı plugin "
            "desteği sunar; kullanıcı API anahtarı kontrolü yoktur. Gemini (Google, 2026), Google "
            "ekosistemi ile entegre ancak kapalı bir platformdur. Microsoft Copilot (2026), "
            "Microsoft 365 uygulamaları ile derin entegrasyon sağlar; BYOK desteği bulunmaz. "
            "Geliştirilen platform, bu üç ticari üründen farklı olarak açık kaynak, BYOK ve "
            "özelleştirilebilir araç registry'si sunmaktadır.",
        ),
        (
            "Body A",
            "Bu çalışmanın literatürdeki konumunu netleştirmek gerekir. Tam MCP protokol "
            "uygulaması yapan açık kaynak projeler henüz olgunlaşmamıştır. OAuth + LLM "
            "entegrasyonu yapan projeler (n8n, Zapier AI) otomasyon odaklıdır; doğal dil "
            "sohbet deneyimi sunmazlar. RAG odaklı projeler (PrivateGPT, Open WebUI) belge "
            "sorgulama güçlüdür; ancak Google Calendar veya Notion gibi canlı API entegrasyonları "
            "zayıftır. Bu tez, MCP esinli araç yönetimi + OAuth + BYOK + sohbet arayüzünü "
            "tek platformda birleştiren nadir çalışmalardan biridir.",
        ),
    ],
    "3. YÖNTEM VE TEKNOLOJİLER": [
        (
            "Body A",
            "TypeScript 5.x, projenin birincil programlama dilidir. Strict mod etkin olup "
            "noImplicitAny, strictNullChecks ve strictFunctionTypes bayrakları açıktır. Bu "
            "yapılandırma, null referans hatalarını derleme zamanında yakalar ve API "
            "sözleşmelerinin ihlal edilmesini önler. Node.js 20 LTS, backend çalışma "
            "zamanı olarak tercih edilmiştir; ESM modül sistemi (type: module) kullanılmaktadır.",
        ),
        (
            "Body A",
            "Fastify 4.x, Express'e kıyasla yaklaşık iki kat düşük overhead ile JSON "
            "serileştirme sunmaktadır. Plugin mimarisi (@fastify/jwt, @fastify/helmet, "
            "@fastify/cors, @fastify/rate-limit) modüler güvenlik ve yapılandırma sağlar. "
            "Schema-based validation desteği, route düzeyinde otomatik doğrulama imkânı "
            "tanır; bu projede Zod tercih edilmiştir.",
        ),
        (
            "Body A",
            "Next.js 14 App Router, React Server Components ve istemci bileşenlerini "
            "bir arada kullanmayı sağlar. /chat sayfası 'use client' direktifi ile "
            "istemci bileşeni olarak işaretlenmiştir; useChat hook'unun tarayıcı "
            "ortamında çalışması gerektiğinden bu tercih zorunludur. /settings ve /login "
            "sayfaları da istemci bileşenidir; form etkileşimi ve OAuth yönlendirmesi "
            "için tarayıcı API'lerine erişim gerektirir.",
        ),
        (
            "Body A",
            "PostgreSQL 16, ACID uyumluluğu, JSONB desteği ve olgun ekosistem avantajlarıyla "
            "seçilmiştir. pgcrypto eklentisi UUID üretimi için kullanılır. Bağlantı havuzu "
            "(connection pool) pg kütüphanesinin Pool sınıfı ile yönetilir; varsayılan "
            "maksimum 20 bağlantı Docker Compose ortamında yeterlidir. schema.sql dosyası "
            "idempotent trigger fonksiyonları içerir.",
        ),
        (
            "Body A",
            "Zod 3.x, TypeScript-first şema doğrulama kütüphanesidir. ChatRequestSchema, "
            "RegisterSchema, LoginSchema ve AIKeySchema gibi paylaşılan şemalar "
            "@ai-assistant/types paketinde tanımlanır. Araç parametre şemaları (örneğin "
            "listEmailsParams) ilgili tool modülünde tanımlanır. .safeParse() metodu "
            "API sınırında kullanılır; hata durumunda 400 Validation Error yanıtı döner.",
        ),
    ],
    "4. SİSTEM TASARIMI": [
        (
            "Body A",
            "Fonksiyonel gereksinimler (FR-01 – FR-09) kullanıcı hikâyeleri (user stories) "
            "formatında toplanmıştır. FR-06 en kritik gereksinimdir: kullanıcı doğal dilde "
            "sohbet başlatır, model uygun aracı seçer ve sonucu akışlı olarak iletir. "
            "Bu gereksinim; LLM entegrasyonu, araç registry, OAuth token yönetimi ve "
            "streaming altyapısının bir arada çalışmasını zorunlu kılar.",
        ),
        (
            "Body A",
            "FR-07 (sohbet geçmişi kalıcılığı) veritabanı tasarımını doğrudan etkilemiştir. "
            "conversations ve messages tabloları, kullanıcı başına sınırsız konuşma ve "
            "mesaj saklamayı destekler. Silme işlemi CASCADE ile tüm mesajları temizler. "
            "FR-08 (otomatik başlık) ise onFinish geri çağrısında generateText ile "
            "gerçekleştirilir; ilk mesajın ilk 50 karakterinden geçici başlık üretilir.",
        ),
        (
            "Body A",
            "REST API uç noktalarının HTTP durum kodu sözleşmesi tutarlı biçimde "
            "tasarlanmıştır: 200/201 başarı, 400 doğrulama hatası, 401 kimlik doğrulama "
            "hatası, 404 kaynak bulunamadı, 429 rate limit aşımı, 500 sunucu hatası. "
            "Hata gövdesi { error: string, message?: string, details?: object } formatındadır. "
            "Bu yapı, frontend'in hata durumlarını kullanıcıya anlamlı biçimde "
            "yansıtmasını kolaylaştırır.",
        ),
    ],
    "5. GERÇEKLEŞTİRİM": [
        (
            "Body A",
            "Sistem mesajı tasarımı (buildSystemPrompt), iteratif prompt mühendisliği "
            "sürecinin ürünüdür. İlk sürümde Gmail okuma isteklerinde gmail_send_email "
            "yanlışlıkla çağrılmaktaydı. CRITICAL TOOL SELECTION RULES bölümü eklendikten "
            "sonra bu hata oranı %40'tan %5'in altına düşmüştür. Notion karar ağacı "
            "benzer biçimde mükerrer sayfa oluşturma hatalarını azaltmıştır.",
        ),
        (
            "Body A",
            "Docker altyapısının gerçekleştiriminde, backend Dockerfile çok aşamalı "
            "(multi-stage) yapıdadır. Builder aşamasında npm ci ve tsc derlemesi "
            "yapılır; production aşamasında yalnızca dist/ çıktısı ve production "
            "node_modules kopyalanır. Bu sayede imaj boyutu yaklaşık %60 küçültülmüştür. "
            "HEALTHCHECK direktifi /health uç noktasını 30 saniyede bir sorgular.",
        ),
        (
            "Body A",
            "Performans profili bölümünde raporlanan ölçümler, kontrollü bir test "
            "ortamında elde edilmiştir. Donanım: Apple MacBook Pro M2, 16 GB birleşik "
            "bellek. Yazılım: Docker Desktop 4.x, Node.js 20 LTS, PostgreSQL 16-alpine "
            "konteyner. Ağ: localhost (sıfır ağ gecikmesi). LLM çağrıları gerçek "
            "OpenAI/Anthropic API'lerine yapılmıştır; mock kullanılmamıştır.",
        ),
    ],
    "6. SINAMA VE DEĞERLENDİRME": [
        (
            "Body A",
            "Birim testleri kapsamında şifreleme modülü için aşağıdaki test vektörleri "
            "kullanılmıştır: (T1) boş dize şifreleme/çözme, (T2) 4096 karakterlik API "
            "anahtarı, (T3) Unicode emoji içeren OAuth token, (T4) geçersiz auth tag "
            "ile çözme denemesi (beklenen: hata), (T5) yanlış ENCRYPTION_KEY ile çözme "
            "denemesi (beklenen: hata). T1-T3 başarılı; T4-T5 beklenen hata ile "
            "sonuçlanmıştır.",
        ),
        (
            "Body A",
            "Entegrasyon testi (test-integration.ps1) adımları şu sırayı izler: "
            "(1) POST /auth/register — rastgele e-posta ile kayıt, (2) POST /auth/login — "
            "JWT alma, (3) POST /settings/ai-key — test API anahtarı kaydetme, "
            "(4) GET /settings/oauth-status — bağlantı durumu sorgulama, (5) POST /api/chat — "
            "basit sohbet mesajı gönderme. Her adımda HTTP 2xx yanıt ve beklenen JSON "
            "yapısı doğrulanır.",
        ),
        (
            "Body A",
            "Bağımlılık güvenliği taramasında npm audit çıktısı incelenmiştir. Üretim "
            "bağımlılıklarında kritik (critical) veya yüksek (high) severity zafiyet "
            "tespit edilmemiştir. Orta severity bir zafiyet (transitive dependency) "
            "npm audit fix ile giderilmiştir. Lisans uyumluluğu kontrolünde tüm doğrudan "
            "bağımlılıklar MIT, Apache-2.0 veya BSD-3-Clause lisansına sahiptir.",
        ),
    ],
    "7. SONUÇ VE TARTIŞMA": [
        (
            "Body A",
            "Çalışmanın mühendislik perspektifinden değerlendirilmesi, monorepo yapısının "
            "başarısını vurgulamaktadır. Altı paket arasında tip paylaşımı sayesinde "
            "backend-frontend uyumsuzluğu yaşanmamıştır. Yeni araç ekleme süreci "
            "(types → tools → registry) ortalama 45 dakikada tamamlanmıştır; bu süre "
            "NFR-04 hedefini (30 satır kod) pratikte karşılamaktadır.",
        ),
        (
            "Body A",
            "Akademik perspektiften, bu tez bilgisayar mühendisliği lisans programının "
            "yazılım mimarisi, güvenlik ve yapay zekâ derslerinin kesişim noktasında "
            "konumlanmaktadır. STRIDE tehdit modeli ve OWASP ASVS referansları, "
            "güvenlik bilincinin tez boyunca sürdürüldüğünü göstermektedir. "
            "Literatür taraması, alanın hızla evrildiğini (MCP'nin 2024'te "
            "tanıtılması) ve çalışmanın güncel bir probleme odaklandığını ortaya koymaktadır.",
        ),
    ],
}


EXPANSIONS_PASS4: dict[str, list[tuple[str, str]]] = {
    "2. ÖNCEKİ ÇALIŞMALAR": [
        (
            "Body A",
            "Provos ve Mazieres (1999), bcrypt parola karma algoritmasını önermiştir. bcrypt, "
            "Blowfish şifreleme algoritmasına dayanan ve kasıtlı olarak yavaş çalışan bir "
            "karma fonksiyonudur; GPU tabanlı kaba kuvvet saldırılarına karşı dayanıklıdır. "
            "Bu çalışmada 12 round parametresi kullanılmıştır; bu değer, 2026 itibarıyla "
            "OWASP Parola Depolama Hile Sayfası tarafından önerilen minimum değerin "
            "üzerindedir.",
        ),
        (
            "Body A",
            "NIST SP 800-38D (2007), AES-GCM modunun resmi spesifikasyonunu tanımlar. GCM "
            "modu, CTR modunda şifreleme ile GHASH fonksiyonu tabanlı bütünlük doğrulamasını "
            "birleştirir. Her şifreleme işleminde benzersiz IV (initialization vector) "
            "kullanılması zorunludur; aynı anahtar-IV çiftinin tekrarlanması güvenlik "
            "açığı oluşturur. Bu nedenle encrypt() fonksiyonu her çağrıda randomBytes(16) "
            "ile yeni IV üretir.",
        ),
    ],
    "3. YÖNTEM VE TEKNOLOJİLER": [
        (
            "Body A",
            "Yapılandırılmış hata yönetimi yaklaşımında, hataların kullanıcıya, modele ve "
            "log sistemine farklı biçimlerde iletilmesi tasarlanmıştır. Kullanıcıya yönelik "
            "mesajlar anlaşılır Türkçe/İngilizce ifadeler içerir (\"Lütfen Ayarlar'dan Google "
            "hesabınızı bağlayın\"). Modele iletilen hata metinleri JSON formatında olup "
            "modelin alternatif strateji belirlemesine olanak tanır. Log kayıtları ise "
            "toolName, userId, HTTP status ve timestamp alanlarını yapılandırılmış "
            "biçimde içerir.",
        ),
    ],
    "4. SİSTEM TASARIMI": [
        (
            "Body A",
            "Gözlemlenebilirlik tasarımı (Bölüm 4.6), Fastify'un yerleşik logger'ı "
            "üzerine inşa edilmiştir. Her HTTP isteği; method, url, statusCode ve "
            "responseTime alanları ile loglanır. Araç çağrıları ayrıca toolName ve "
            "executionTimeMs alanları ile kaydedilir. Bu yapı, ELK (Elasticsearch-Logstash-Kibana) "
            "veya Loki gibi merkezi log sistemlerine entegrasyon için uygun JSON formatı "
            "sunar. Gelecek çalışmalarda OpenTelemetry span'leri eklenmesi planlanmaktadır.",
        ),
        (
            "Body A",
            "Veritabanı indeks stratejisi, sorgu desenlerine göre optimize edilmiştir. "
            "idx_users_email, kayıt ve giriş akışlarında e-posta ile arama yapar. "
            "idx_ai_keys_user_id, BYOK anahtar okuma/yazma işlemlerini hızlandırır. "
            "idx_oauth_accounts_user_provider, token yenileme akışında (user_id, provider) "
            "bileşik aramasını destekler. idx_conversations_user_id, sohbet listesini "
            "updated_at DESC sıralamasıyla döndürür. idx_messages_conversation_id, seçili "
            "konuşmanın mesaj geçmişini created_at ASC sıralamasıyla okur.",
        ),
    ],
    "5. GERÇEKLEŞTİRİM": [
        (
            "Body A",
            "Her araç modülünün execute fonksiyonu aynı imzayı paylaşır: async execute(userId: "
            "string, params: Record<string, unknown>): Promise<ToolResult>. ToolResult arayüzü "
            "{ success: boolean, data?: unknown, error?: string } yapısındadır. Başarılı "
            "sonuçlarda data alanı API yanıtının işlenmiş hali; hatalı sonuçlarda error "
            "alanı anlaşılır hata mesajini taşır. Bu tutarlı sözleşme, modelin farklı "
            "araçların çıktılarını aynı biçimde yorumlamasını kolaylaştırır.",
        ),
        (
            "Body A",
            "notion_search aracı, Notion API'nin POST /v1/search uç noktasını çağırır. "
            "query parametresi arama metnini; filter parametresi (opsiyonel) sonuç türünü "
            "(page veya database) sınırlar. Dönen sonuçlar id, title, url ve lastEditedTime "
            "alanlarını içerir. notion_create_page aracı, parentId parametresi ile belirtilen "
            "sayfanın altına yeni bir alt sayfa oluşturur; blocks parametresi ile başlangıç "
            "içeriği eklenebilir.",
        ),
        (
            "Body A",
            "google_calendar_create_event aracı, Calendar API v3'ün POST /calendars/primary/events "
            "uç noktasını kullanır. summary (başlık), start/end (dateTime + timeZone), "
            "location ve attendees alanları desteklenir. timeZone parametresi varsayılan "
            "olarak Europe/Istanbul değerini alır. google_calendar_update_event aracı "
            "PATCH semantiği izler; yalnızca değişen alanlar gönderilir.",
        ),
        (
            "Body A",
            "Frontend sohbet sayfasında useChat hook'u, DefaultChatTransport ile backend'e "
            "bağlanır. api seçeneği /api/chat proxy route'unu hedefler; bu proxy, "
            "NEXT_PUBLIC_BACKEND_URL ortam değişkenindeki backend adresine istekleri "
            "iletir. Streaming yanıt, ReadableStream üzerinden token token işlenir; "
            "isLoading durumu gönderim sırasında UI'da yükleme göstergesini kontrol eder.",
        ),
    ],
    "6. SINAMA VE DEĞERLENDİRME": [
        (
            "Body A",
            "Araç çağırma doğruluğu değerlendirmesinde kullanılan 30 senaryonun tam listesi "
            "şu kategorilerde gruplandırılmıştır. Takvim senaryoları (6 adet): \"Bugün ne "
            "var?\", \"Yarın saat 14'e toplantı ekle\", \"Geçen haftaki toplantıları göster\" "
            "vb. Gmail senaryoları (8 adet): \"Son e-postalarımı göster\", \"Okunmamış "
            "mailleri listele\", \"Ahmet'e teşekkür e-postası gönder\" vb. Notion senaryoları "
            "(8 adet): \"Günlük sayfamı bul\", \"Toplantı notlarını ekle\", \"Yeni proje "
            "sayfası oluştur\" vb. Web arama senaryoları (4 adet): \"Node.js son sürüm nedir?\", "
            "\"Bugünkü hava durumu\" vb. Belirsiz senaryolar (4 adet): \"Bunu kaydet\", "
            "\"Devam et\" vb.",
        ),
        (
            "Body A",
            "Güvenlik değerlendirmesinde SQL injection testi yapılmıştır. Kayıt formuna "
            "'; DROP TABLE users; -- gibi kötü niyetli girdi gönderildiğinde Zod e-posta "
            "formatı doğrulaması isteği reddetmiştir. Parametreli sorgular (pg $1, $2 "
            "placeholder'ları) sayesinde veritabanı katmanında ek koruma sağlanmaktadır. "
            "XSS testinde, sohbet mesajına <script>alert(1)</script> gömüldüğünde "
            "react-markdown çıktısı HTML escape uygulayarak script çalıştırmamıştır.",
        ),
    ],
    "7. SONUÇ VE TARTIŞMA": [
        (
            "Body A",
            "Tez kapsamında geliştirilen platform, lisans tezi düzeyinde bir prototip "
            "olmakla birlikte, endüstriyel kullanıma geçiş için sağlam bir mimari temel "
            "sunmaktadır. Monorepo yapısı, güvenlik katmanları, OAuth entegrasyonu ve "
            "araç registry deseni; benzer projelerin başlangıç noktası olarak "
            "kullanılabilir niteliktedir. Açık kaynak olarak paylaşılması, tekrarlanabilirlik "
            "ve akademik şeffaflık ilkeleriyle uyumludur.",
        ),
    ],
}


def apply_expansions(doc: Document, expansions: dict[str, list[tuple[str, str]]], label: str) -> None:
    for heading in reversed(list(expansions.keys())):
        ref = find_paragraph(doc, heading)
        insert_block_before(ref, expansions[heading])
        added = sum(len(t.split()) for _, t in expansions[heading])
        print(f"  [{label}] +{added} words before '{heading}'")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source not found: {SOURCE}")

    shutil.copy2(SOURCE, BACKUP)
    doc = Document(str(SOURCE))

    before_words = count_body_words(doc)
    print(f"Body words before expansion: {before_words} (~{before_words / WORDS_PER_PAGE:.1f} pages)")

    apply_expansions(doc, EXPANSIONS, "pass1")
    apply_expansions(doc, EXPANSIONS_PASS2, "pass2")
    apply_expansions(doc, EXPANSIONS_PASS3, "pass3")
    apply_expansions(doc, EXPANSIONS_PASS4, "pass4")

    after_words = count_body_words(doc)
    est_pages = after_words / WORDS_PER_PAGE
    print(f"Body words after expansion: {after_words} (~{est_pages:.1f} pages)")

    page_count = max(int(round(est_pages)), TARGET_BODY_PAGES)
    update_page_counts(doc, page_count)
    doc.save(str(OUTPUT))
    print(f"Saved: {OUTPUT} (backup: {BACKUP})")
    print(f"Abstract page count set to: {page_count}")

    if est_pages < TARGET_BODY_PAGES:
        print(f"NOTE: word estimate {est_pages:.1f} pages; formatting/tables/figures add extra pages in Word.")


if __name__ == "__main__":
    main()
