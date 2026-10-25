//! plant-diary-pam-auth SERVICE
//!
//! Reads "username\npassword\n" from stdin and checks it with PAM (authentication and
//! account management). Exit status: 0 = accepted, 1 = rejected, 2 = usage error.
//!
//! For pam_unix to verify other users' passwords, the calling process must be able to
//! read /etc/shadow (the NixOS module adds the service to the "shadow" group).

use std::io::{self, BufRead};
use std::process::ExitCode;

fn main() -> ExitCode {
    let mut args = std::env::args().skip(1);
    let (Some(service), None) = (args.next(), args.next()) else {
        eprintln!("usage: printf 'user\\npassword\\n' | plant-diary-pam-auth SERVICE");
        return ExitCode::from(2);
    };

    let mut lines = io::stdin().lock().lines();
    let (Some(Ok(username)), Some(Ok(password))) = (lines.next(), lines.next()) else {
        eprintln!("expected username and password on stdin");
        return ExitCode::from(2);
    };

    let mut client = match pam::Client::with_password(&service) {
        Ok(client) => client,
        Err(e) => {
            eprintln!("PAM: cannot start service {service}: {e}");
            return ExitCode::from(1);
        }
    };
    client.conversation_mut().set_credentials(&username, &password);
    match client.authenticate() {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("PAM: {username}: {e}");
            ExitCode::from(1)
        }
    }
}
