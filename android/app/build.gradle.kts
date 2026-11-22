plugins {
    id("com.android.application")
}

// The app is a Trusted Web Activity: it opens https://mysimpledesk.co.uk full screen, with no browser bar.
// Raise versionCode by 1 for every new upload to Google Play (set it in android/version.properties).
val versionProps = java.util.Properties().apply {
    val f = rootProject.file("version.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}

android {
    namespace = "uk.co.mysimpledesk.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "uk.co.mysimpledesk.app"
        minSdk = 23
        targetSdk = 35
        versionCode = (versionProps.getProperty("versionCode") ?: "1").toInt()
        versionName = versionProps.getProperty("versionName") ?: "1.0.0"
    }

    // Signing details come from the build machine's secrets, never from the code.
    val keystorePath: String? = System.getenv("KEYSTORE_PATH")
    signingConfigs {
        if (keystorePath != null && file(keystorePath).exists()) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
