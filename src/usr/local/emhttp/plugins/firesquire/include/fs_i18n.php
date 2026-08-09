<?php
/* FireSquire -- inject the active Unraid UI language into the page, so
 * firesquire.js renders in the user's configured language for ALL locales.
 * Reads $_SESSION['locale'] (Unraid's configured language), loads lang/en.json
 * as the base and merges lang/<code>.json over it, then exposes the result as
 * window.fireSquireI18n. Included by FireSquire.page + FireSquireTools.page.
 * Emits nothing but a <script>; defines no functions (safe on any Unraid page). */
if (!defined('FS_I18N_EMITTED')) {
  define('FS_I18N_EMITTED', 1);
  $fsLang = strtolower(substr((string) (isset($_SESSION['locale']) ? $_SESSION['locale'] : ''), 0, 2));
  $fsDir  = '/usr/local/emhttp/plugins/firesquire/lang';
  $fsAll  = json_decode(@file_get_contents("$fsDir/en.json"), true);
  if (!is_array($fsAll)) $fsAll = array();
  if ($fsLang !== '' && $fsLang !== 'en' && is_file("$fsDir/$fsLang.json")) {
    $fsTr = json_decode(@file_get_contents("$fsDir/$fsLang.json"), true);
    if (is_array($fsTr)) $fsAll = array_merge($fsAll, $fsTr);
  }
  echo '<script>window.fireSquireLang=' . json_encode($fsLang !== '' ? $fsLang : 'en')
     . ';window.fireSquireI18n=' . json_encode($fsAll, JSON_UNESCAPED_UNICODE) . ';</script>';
}
