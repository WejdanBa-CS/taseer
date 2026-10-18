plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "sa.taseer.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "sa.taseer.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets.named("main") {
        assets.srcDir(layout.buildDirectory.dir("generated/webassets"))
    }
}

val webRoot = rootProject.layout.projectDirectory.dir("..")

val copyWebAssets = tasks.register<Copy>("copyWebAssets") {
    from(webRoot) {
        include("index.html")
        include("favicon.svg")
        include("css/**")
        include("js/**")
        include("fonts/**")
    }
    into(layout.buildDirectory.dir("generated/webassets/www"))
    doFirst {
        val index = webRoot.file("index.html").asFile
        if (!index.exists()) {
            throw GradleException("ما لقيت index.html بجانب مجلد android. افتح المستودع كامل في Android Studio.")
        }
    }
}

tasks.configureEach {
    if (name.matches(Regex("merge.*Assets"))) {
        dependsOn(copyWebAssets)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    debugImplementation("com.google.android.gms:play-services-ads:23.6.0")
}
