#compdef togalma

# Zsh completion for togalma CLI.

_togalma() {
  local -a global_opts
  global_opts=(
    '--base-url[API base URL]:url:_urls'
    '--allow-insecure[Allow non-HTTPS baseUrl]'
    '--debug[Enable debug mode]'
    '--help[Show help]'
    '--version[Show version]'
  )

  local curcontext="$curcontext" state line
  typeset -A opt_args

  _arguments -C \
    $global_opts \
    '1:command:->cmd' \
    '*::args:->args'

  case $state in
    cmd)
      _values 'command' auth menu order orders
      return
      ;;
    args)
      case $words[2] in
        auth)
          _values 'auth command' login logout whoami register
          return
          ;;
        menu)
          _arguments \
            $global_opts \
            '--search[Search query]:query:' \
            '--date[Menu date]:date:' \
            '--category[Category]:category:(plat dessert boisson all)' \
            '--no-order[Do not prompt to create an order after browsing]'
          return
          ;;
        order)
          case $words[3] in
            create)
              _arguments \
                $global_opts \
                '--date[Delivery date]:date:'
              return
              ;;
            pay)
              _arguments \
                $global_opts \
                '--timeout-seconds[Max wait time]:seconds:' \
                '1:orderId:'
              return
              ;;
            *)
              _values 'order command' create pay
              return
              ;;
          esac
          ;;
        orders)
          case $words[3] in
            list)
              _arguments \
                $global_opts \
                '--limit[Max results]:n:'
              return
              ;;
            show)
              _arguments \
                $global_opts \
                '1:orderId:'
              return
              ;;
            *)
              _values 'orders command' list show
              return
              ;;
          esac
          ;;
      esac
      ;;
  esac
}

_togalma "$@"

