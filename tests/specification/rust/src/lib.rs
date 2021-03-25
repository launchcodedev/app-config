mod app_config;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let _ = app_config::load_config().unwrap();
    }
}
