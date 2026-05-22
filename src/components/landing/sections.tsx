import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"

export const sections = [
  {
    id: 'hero',
    subtitle: <Badge variant="outline" className="text-white border-white">Регистрация открыта</Badge>,
    title: "Реклама, которая приносит доход.",
    showButton: true,
    buttonText: 'Начать зарабатывать'
  },
  {
    id: 'about',
    title: 'Как это работает?',
    content: 'Покупаете рекламу от 100 ₽ в неделю — и сразу начинаете получать 10% дивидендов от суммы. Всё начисляется автоматически, каждую секунду, прямо на ваш счёт.'
  },
  {
    id: 'features',
    title: 'Удобно и прозрачно',
    content: 'Пополняйте баланс картой, СБП или криптовалютой. В личном кабинете вы видите, как растут ваши дивиденды в реальном времени — никаких задержек и скрытых условий.'
  },
  {
    id: 'profile',
    isProfile: true,
  },
  {
    id: 'join',
    title: 'Присоединяйтесь сегодня',
    content: 'Короткая регистрация, минимальный вход от 100 ₽. Начните получать дивиденды уже через несколько минут.',
    showButton: true,
    buttonText: 'Зарегистрироваться',
    footer: (
      <div className="flex flex-wrap gap-4 mt-8">
        <Link to="/terms" className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors">Пользовательское соглашение</Link>
        <Link to="/privacy" className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors">Политика конфиденциальности</Link>
        <Link to="/offer" className="text-neutral-500 hover:text-neutral-300 text-sm transition-colors">Публичная оферта</Link>
      </div>
    )
  },
]