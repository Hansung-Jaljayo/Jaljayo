pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    // 11/19 나노 USB 읽기(usb-serial-for-android)는 JitPack에만 올라와 있어 함께 둔다
    repositories { google(); mavenCentral(); maven { url = uri("https://jitpack.io") } }
}
rootProject.name = "jaljayo-board"
include(":app")
