// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::env::{self, args};
use reqwest::blocking::Client;
mod config;

// 通过JSON-RPC通知aria2c添加下载
fn query_health() -> Result<(), String> {
    let client = Client::new();
    let url = "http://127.0.0.1:6567/health";

    match client.get(url).send() {
        Ok(response) => {
            if response.status().is_success() {
                println!("aria2c is healthy");
                Ok(())
            } else {
                Err(format!("aria2c returned error: {}", response.status()))
            }
        },
        Err(e) => Err(format!("Failed to query health: {}", e)),
    }
}

fn send_command(command :&str) {
    let client  = Client::new();
    let url = "http://127.0.0.1:6567/command";
    match client.post(url).json(&command).send() {
        Ok(response) => {
            if response.status().is_success() {
                println!("Command sent successfully");
            } else {
                println!("Failed to send command: {}", response.status());
            }
        },
        Err(e) => println!("Error sending command: {}", e),
    }
}

fn main() {

    let args :Vec<String>= env::args().collect();
    
    println!("args : {:?}", args);
    match query_health() {
        Ok(_) => {
            if args.len()> 1 {
                send_command(args[1].as_str());
            }
            println!("aria2c is healthy");
        },
        Err(e) =>{
            dlapp_lib::run();
        },
    }
    
}
