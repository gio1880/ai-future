from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port,Direction
from pybricks.robotics import DriveBase
from pybricks.tools import multitask, run_task


hub = PrimeHub()
leftWheel   = Motor(Port.F, Direction.COUNTERCLOCKWISE)
rightWheel  = Motor(Port.E, Direction.CLOCKWISE)
wheelsize   = 56
axletrackwidth = 110
#robot and robot initial settings
robot = DriveBase(leftWheel,rightWheel,wheelsize,axletrackwidth)
robot.settings(straight_speed=400,straight_acceleration=200,turn_rate=400,turn_acceleration=200 )

#left attachment motor
LAM = Motor(Port.B, Direction.COUNTERCLOCKWISE)
# #right attachment motor
RAM = Motor(Port.A,Direction.COUNTERCLOCKWISE)

#Turn on Gyro Sensor if the hub is good, turn off if it is bad
robot.use_gyro(True)
hub.imu.reset_heading(0)

if hub.imu.ready():
        robot.straight(690)
        robot.turn(-45)
  