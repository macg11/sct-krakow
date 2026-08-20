package pl.gralek.sct

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.os.Bundle
import android.speech.tts.TextToSpeech
import java.util.Locale
import android.text.InputType
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView

private const val HOST = "sct.zdmk.krakow.pl"
private const val START_URL = "https://$HOST/#/payment/lookup"

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var status: TextView
    private lateinit var prefs: android.content.SharedPreferences
    private var script: String = ""
    private var tts: TextToSpeech? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("sct", Context.MODE_PRIVATE)
        tts = TextToSpeech(this) { st -> if (st == TextToSpeech.SUCCESS) tts?.language = Locale("pl", "PL") }
        script = assets.open("autofill.js").bufferedReader().use { it.readText() }

        web = findViewById(R.id.web)
        status = findViewById(R.id.status)
        // jedyna interakcja w apce: przytrzymanie paska statusu otwiera ustawienia
        status.setOnLongClickListener { showSettings(); true }

        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = true
            displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = true
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)

        web.addJavascriptInterface(Bridge(), "SCTBridge")
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {

            override fun onPageStarted(v: WebView?, url: String?, favicon: Bitmap?) {
                if (url != null && !url.contains(HOST)) setStatus("bramka płatnicza — dalej ręcznie")
            }

            override fun onPageFinished(view: WebView, url: String) {
                // skrypt tylko na stronie SCT; na bramce płatniczej nic nie ruszamy
                if (url.contains(HOST)) view.evaluateJavascript(config() + script, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView, url: String): Boolean {
                if (url.startsWith("http://") || url.startsWith("https://")) return false
                // intent:// , blik:// , aplikacje bankowe -> oddaj systemowi
                return try {
                    val i = if (url.startsWith("intent:"))
                        Intent.parseUri(url, Intent.URI_INTENT_SCHEME)
                    else Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url))
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(i)
                    true
                } catch (e: Exception) {
                    setStatus("nie mogę otworzyć: $url")
                    true
                }
            }
        }

        if (prefs.getString("plate", "").isNullOrBlank()) showSettings() else restart()
    }

    /** tap w ikonę na ekranie głównym = zawsze świeży przebieg, nawet gdy apka wisi w tle */
    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (!prefs.getString("plate", "").isNullOrBlank()) restart()
    }

    /** konfiguracja wstrzykiwana przed skryptem */
    private fun config(): String {
        val plate = prefs.getString("plate", "")
        val email = prefs.getString("email", "")
        val offset = prefs.getInt("offset", 5)
        val autoPay = prefs.getBoolean("autoPay", true)
        return """window.SCT_CFG={plate:"$plate",email:"$email",offsetMin:$offset,price:"5",autoPay:$autoPay};
                  window.__sctRunning=false;"""
    }

    private fun restart() {
        setStatus("start…")
        web.clearHistory()
        web.loadUrl(START_URL)
    }

    private fun setStatus(m: String) = runOnUiThread {
        status.text = m + "   ·   przytrzymaj, by zmienić dane"
    }

    inner class Bridge {
        @JavascriptInterface
        fun status(m: String) = setStatus(m)

        /** czytane na głos tylko kluczowe momenty: koniec przebiegu i błąd */
        @JavascriptInterface
        fun say(m: String) {
            if (!prefs.getBoolean("speak", true)) return
            runOnUiThread { tts?.speak(m, TextToSpeech.QUEUE_FLUSH, null, "sct") }
        }
    }

    override fun onDestroy() {
        tts?.shutdown()
        super.onDestroy()
    }

    private fun showSettings() {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 0)
        }
        val plate = EditText(this).apply {
            hint = "numer rejestracyjny"
            setText(prefs.getString("plate", ""))
        }
        val email = EditText(this).apply {
            hint = "e-mail"
            inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setText(prefs.getString("email", ""))
        }
        val offset = EditText(this).apply {
            hint = "wjazd za ile minut"
            inputType = InputType.TYPE_CLASS_NUMBER
            setText(prefs.getInt("offset", 5).toString())
        }
        val autoPay = CheckBox(this).apply {
            text = "sam klikaj ZAPŁAĆ (do bramki)"
            isChecked = prefs.getBoolean("autoPay", true)
        }
        val speak = CheckBox(this).apply {
            text = "czytaj komunikaty na głos"
            isChecked = prefs.getBoolean("speak", true)
        }
        listOf(plate, email, offset, autoPay, speak).forEach { box.addView(it) }

        AlertDialog.Builder(this)
            .setTitle("Ustawienia")
            .setView(box)
            .setPositiveButton("Zapisz") { _, _ ->
                prefs.edit()
                    .putString("plate", plate.text.toString().trim().uppercase())
                    .putString("email", email.text.toString().trim())
                    .putInt("offset", offset.text.toString().toIntOrNull() ?: 5)
                    .putBoolean("autoPay", autoPay.isChecked)
                    .putBoolean("speak", speak.isChecked)
                    .apply()
                restart()
            }
            .setNegativeButton("Anuluj", null)
            .show()
    }

    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else super.onBackPressed()
    }
}
