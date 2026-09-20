<?php

namespace App\Services\Notification;

use App\Contracts\NotificationStrategyInterface;
use App\Models\User;
use App\Services\Notification\Strategies\AdminNotificationStrategy;
use App\Services\Notification\Strategies\CartNotificationStrategy;
use App\Services\Notification\Strategies\DepartmentHeadNotificationStrategy;
use App\Services\Notification\Strategies\HrNotificationStrategy;
use App\Services\Notification\Strategies\MayorNotificationStrategy;
use App\Services\Notification\Strategies\ReceivingNotificationStrategy;

class NotificationStrategyFactory
{
    /**
     * Resolve the appropriate notification document query strategy for the given user role.
     */
    public static function make(User $user): NotificationStrategyInterface
    {
        $role = strtolower($user->role->role_name ?? '');

        return match ($role) {
            'admin'                                  => new AdminNotificationStrategy(),
            'cart'                                   => new CartNotificationStrategy(),
            'mayor'                                  => new MayorNotificationStrategy(),
            'hr'                                     => new HrNotificationStrategy(),
            'department head', 'department_head'     => new DepartmentHeadNotificationStrategy(),
            'receiving clerk', 'receiving'           => new ReceivingNotificationStrategy(),
            default                                  => new ReceivingNotificationStrategy(),
        };
    }
}
