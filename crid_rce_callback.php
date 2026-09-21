<?php
$token = isset($_GET['token']) ? $_GET['token'] : 'NO_TOKEN';
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'NO_UA';
$ip = $_SERVER['REMOTE_ADDR'];
$ts = date('Y-m-d_H:i:s');
$log_file = '/tmp/CRIDVER_CALLBACKS.log';
$entry = "[RCE_CALLBACK $ts] IP=$ip  TOKEN=$token  UA=$ua  QUERY=".http_build_query($_GET)."\n";
@file_put_contents($log_file, $entry, FILE_APPEND | LOCK_EX);
$d = '/tmp/CRIDVERIFY_PWNED'; @mkdir($d, 0755, true);
@file_put_contents("$d/CALLBACK_IP_{$ip}_TIME_{$ts}_TOKEN_".preg_replace('/[^A-Za-z0-9_]/','',$token).".txt", $entry);
header("HTTP/1.1 204 No Content"); header("X-CRID-Verified: OK"); flush();
?>
