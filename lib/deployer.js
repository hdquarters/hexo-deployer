const fs = require("fs");
const ini = require("ini");
const path = require("path");
const s3 = require("@hdquarters/node-s3-client");
const chalk = require("chalk");
const xtend = require("xtend");

module.exports = function (args) {
  let config = {
    maxAsyncS3: args.concurrency,
    s3Options: {
      accessKeyId:
        args.aws_key || process.env.AWS_ACCESS_KEY_ID || process.env.AWS_KEY,
      secretAccessKey:
        args.aws_secret ||
        process.env.AWS_SECRET_ACCESS_KEY ||
        process.env.AWS_SECRET,
      region: args.region,
    },
  };
  if (
    !config.s3Options.accessKeyId &&
    !config.s3Options.secretAccessKey &&
    args.aws_cli_profile
  ) {
    /* User configured their access and secret keys in ~/.aws/credentials, check there */
    let iniFile = path.join(process.env.HOME, ".aws");
    let iniCredentials = ini.parse(
      fs.readFileSync(path.join(iniFile, "credentials"), "utf-8")
    );
    config.s3Options.accessKeyId = (
      iniCredentials[args.aws_cli_profile] || {}
    ).aws_access_key_id;
    config.s3Options.secretAccessKey = (
      iniCredentials[args.aws_cli_profile] || {}
    ).aws_secret_access_key;
    if (!config.s3Options.region) {
      let iniConfig = ini.parse(
        fs.readFileSync(path.join(iniFile, "config"), "utf-8")
      );
      let profilePath =
        args.aws_cli_profile === "default"
          ? args.aws_cli_profile
          : "profile " + args.aws_cli_profile;
      config.s3Options.region = (iniConfig[profilePath] || {}).region;
    }
  }
  let client = s3.createClient(config);

  let publicDir = this.config.public_dir;
  let log = this.log;

  let customHeaders = args.headers || {};
  let deleteRemoved = args.hasOwnProperty("delete_removed")
    ? Boolean(args.delete_removed)
    : true;

  if (
    !args.bucket ||
    !config.s3Options.accessKeyId ||
    !config.s3Options.secretAccessKey
  ) {
    const help = `
      You should configure deployment settings in _config.yml first!
      Example:
      deploy:
      type: s3
      bucket: <bucket>
      [aws_key]: <aws_key>        # Optional, if provided as environment variable
      [aws_secret]: <aws_secret>  # Optional, if provided as environment variable
      [concurrency]: <concurrency>
      [region]: <region>          # See https://github.com/LearnBoost/knox#region
      [headers]: <JSON headers>   # Optional, see README.md file
      [prefix]: <prefix>          # Optional, prefix ending in
      [delete_removed]: <delete>  # Optional, if true will delete removed files from S3
      For more help, you can check the docs: ${chalk.underline(
        "https://github.com/nt3rp/hexo-deployer-s3"
      )}
    `;

    console.log(help);
    return;
  }

  let params = {
    localDir: publicDir,
    deleteRemoved: deleteRemoved,
    s3Params: xtend(
      {
        Bucket: args.bucket,
        Prefix: args.prefix,
      },
      customHeaders
    ),
  };

  let uploader = client.uploadDir(params);
  log.info("Uploading...");

  return uploader
    .on("progress", function () {
      //   log.info(uploader.progressAmount + ' / ' + uploader.progressTotal);
    })
    .on("end", function () {
      log.info("Done!");
    })
    .on("error", function (err) {
      log.error(err);
    });
};
