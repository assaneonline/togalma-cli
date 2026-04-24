# Bash completion for togalma CLI.

_togalma_complete() {
  local cur prev words cword
  _init_completion -n : || return

  local global_opts="--base-url --allow-insecure --debug --help --version -h -V"

  # First word after command: top-level command
  if [[ ${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "auth menu order orders ${global_opts}" -- "$cur") )
    return
  fi

  local cmd="${words[1]}"
  case "$cmd" in
    auth)
      if [[ ${cword} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "login logout whoami register ${global_opts}" -- "$cur") )
        return
      fi
      COMPREPLY=( $(compgen -W "${global_opts}" -- "$cur") )
      return
      ;;

    menu)
      case "$prev" in
        --category)
          COMPREPLY=( $(compgen -W "plat dessert boisson all" -- "$cur") )
          return
          ;;
        --date)
          COMPREPLY=( $(compgen -W "YYYY-MM-DD" -- "$cur") )
          return
          ;;
      esac
      COMPREPLY=( $(compgen -W "--search --date --category --no-order ${global_opts}" -- "$cur") )
      return
      ;;

    order)
      if [[ ${cword} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "create pay ${global_opts}" -- "$cur") )
        return
      fi

      local sub="${words[2]}"
      case "$sub" in
        create)
          case "$prev" in
            --date)
              COMPREPLY=( $(compgen -W "YYYY-MM-DD" -- "$cur") )
              return
              ;;
          esac
          COMPREPLY=( $(compgen -W "--date ${global_opts}" -- "$cur") )
          return
          ;;
        pay)
          COMPREPLY=( $(compgen -W "--timeout-seconds ${global_opts}" -- "$cur") )
          return
          ;;
      esac
      ;;

    orders)
      if [[ ${cword} -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "list show ${global_opts}" -- "$cur") )
        return
      fi

      local sub="${words[2]}"
      case "$sub" in
        list)
          COMPREPLY=( $(compgen -W "--limit ${global_opts}" -- "$cur") )
          return
          ;;
        show)
          COMPREPLY=( $(compgen -W "${global_opts}" -- "$cur") )
          return
          ;;
      esac
      ;;
  esac

  COMPREPLY=( $(compgen -W "${global_opts}" -- "$cur") )
}

complete -F _togalma_complete togalma

