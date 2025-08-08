```java
import com.example.demo.controller.UserController;
import com.example.demo.model.User;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

import java.util.List;

public class UserControllerTest {

    @Test
    void testGetUsersEmptyList() {
        UserController controller = new UserController();
        List<User> users = controller.getUsers();
        assertTrue(users.isEmpty());
    }
}
```