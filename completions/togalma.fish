# Fish completion for togalma CLI.

# Global options
complete -c togalma -l base-url -d "API base URL" -r
complete -c togalma -l allow-insecure -d "Allow non-HTTPS baseUrl"
complete -c togalma -l debug -d "Enable debug mode"

# Top-level commands
complete -c togalma -f -n "__fish_use_subcommand" -a auth -d "Authentication"
complete -c togalma -f -n "__fish_use_subcommand" -a menu -d "Browse menu"
complete -c togalma -f -n "__fish_use_subcommand" -a order -d "Create and pay orders"
complete -c togalma -f -n "__fish_use_subcommand" -a orders -d "Order history"

# auth subcommands
complete -c togalma -f -n "__fish_seen_subcommand_from auth; and __fish_use_subcommand" -a login -d "Login with phone + PIN"
complete -c togalma -f -n "__fish_seen_subcommand_from auth; and __fish_use_subcommand" -a logout -d "Clear local session"
complete -c togalma -f -n "__fish_seen_subcommand_from auth; and __fish_use_subcommand" -a whoami -d "Show current session user"
complete -c togalma -f -n "__fish_seen_subcommand_from auth; and __fish_use_subcommand" -a register -d "Create an account"

# menu options
complete -c togalma -n "__fish_seen_subcommand_from menu" -l search -d "Search query" -r
complete -c togalma -n "__fish_seen_subcommand_from menu" -l date -d "Menu date" -r
complete -c togalma -n "__fish_seen_subcommand_from menu" -l category -d "Category" -r -a "plat dessert boisson all"
complete -c togalma -n "__fish_seen_subcommand_from menu" -l no-order -d "Do not prompt to create an order after browsing"

# order subcommands
complete -c togalma -f -n "__fish_seen_subcommand_from order; and __fish_use_subcommand" -a create -d "Interactive order creation"
complete -c togalma -f -n "__fish_seen_subcommand_from order; and __fish_use_subcommand" -a pay -d "Pay with Wave"

# order create options
complete -c togalma -n "__fish_seen_subcommand_from order; and __fish_seen_subcommand_from create" -l date -d "Delivery date" -r

# order pay options + args
complete -c togalma -n "__fish_seen_subcommand_from order; and __fish_seen_subcommand_from pay" -l timeout-seconds -d "Max wait time" -r

# orders subcommands
complete -c togalma -f -n "__fish_seen_subcommand_from orders; and __fish_use_subcommand" -a list -d "List orders"
complete -c togalma -f -n "__fish_seen_subcommand_from orders; and __fish_use_subcommand" -a show -d "Show order detail"

# orders list options
complete -c togalma -n "__fish_seen_subcommand_from orders; and __fish_seen_subcommand_from list" -l limit -d "Max results" -r

