// メインの関数
function checkPermissionsAndNotifySlack() {
  const folderId = ""; // 対象フォルダのID
  const slackWebhookUrl = ""; // SlackのWebhook URL
  const allowedDomains = [".fw@gmail.com", "@gmail.com"]; // 許可するメールアドレスのドメイン

  const folder = DriveApp.getFolderById(folderId);
  const results = processFolder(folder, allowedDomains);

  notifySlack(slackWebhookUrl, results);
}

// 再帰的にフォルダを処理する関数
function processFolder(folder, allowedDomains) {
  const results = [];

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();

    // ファイル名に【共有用】が含まれる場合はスキップ
    if (file.getName().includes("【共有用】")) {
      continue;
    }

    const issues = checkFilePermissions(file, allowedDomains);
    if (issues.length > 0) {
      results.push({
        name: file.getName(),
        link: file.getUrl(),
        issues: issues,
      });
    }
  }

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const subFolder = subFolders.next();
    results.push(...processFolder(subFolder, allowedDomains));
  }

  return results;
}

// ファイルの権限を確認する関数
function checkFilePermissions(file, allowedDomains) {
  const issues = [];
  const permissions = file.getSharingAccess();
  const editors = file.getEditors();
  const viewers = file.getViewers();

  // 「リンクを知っている人全員」かどうか確認
  if (permissions === DriveApp.Access.ANYONE_WITH_LINK) {
    issues.push("リンクを知っている人全員にアクセス可能");
  }

  // 許可されていないメールアドレスを確認
  [...editors, ...viewers].forEach(user => {
    const email = user.getEmail();
    const isAllowed = allowedDomains.some(domain => email.endsWith(domain));
    if (!isAllowed) {
      issues.push(`許可されていない共有: ${email}`);
    }
  });

  return issues;
}

// Slackに通知を送信する関数
function notifySlack(slackWebhookUrl, results) {
  if (results.length === 0) {
    Logger.log("該当するファイルはありません。");
    return;
  }

  const payload = {
    text: `以下のファイルで権限の問題が見つかりました:`,
    attachments: results.map(result => ({
      title: result.name,
      title_link: result.link,
      text: result.issues.join("\n"),
      color: "#ff0000",
    })),
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  UrlFetchApp.fetch(slackWebhookUrl, options);
  Logger.log("Slackに通知を送信しました。");
}
